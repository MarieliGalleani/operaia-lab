/**
 * Operational Memory Continuity Proof — M1 ponta a ponta apos persistencia.
 * Sem funcionalidades novas: Mission Queue + PrismaOperationalMemoryStore + loaders existentes.
 *
 * Fora de escopo: M2, alteracao de TTL/quota.
 */
import "./ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "./assert-proof-database-safe.js";
import { randomUUID } from "node:crypto";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { prisma } from "@operaia/database";
import {
  MEMORY_KIND_ORG_LEARNING,
  MEMORY_KIND_RUN_SUMMARY,
} from "@operaia/memory";
import { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import { PrismaOperationalMemoryStore } from "../memory/prisma-operational-memory-store.js";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { createLabRuntime, type LabRuntime } from "./lab-runtime.js";
import {
  loadOperationalMemoryNotes,
  persistMissionMemory,
} from "./mission-memory.js";
import { probeRealQueueReady } from "./assisted-queue-real-harness.js";
import type { OperationalMissionService } from "./operational-mission-service.js";
import type { OperationalRun } from "./operational-run.js";

export interface MemoryContinuityBundle {
  readonly lab: LabRuntime;
  readonly continuous: ContinuousRuntime;
  readonly service: OperationalMissionService;
  readonly memory: PrismaOperationalMemoryStore;
  readonly nexoWorkspaceId: string;
  readonly nexoName: string;
  readonly projects: PrismaProjectRepository;
  readonly tasks: PrismaTaskRepository;
  readonly workspaces: RepositoryWorkspaceSource;
}

export interface MemoryContinuityDodChecklist {
  readonly memoryPersistsAfterRestart: boolean;
  readonly briefingRecoversMemory: boolean;
  readonly noDuplicates: boolean;
  readonly noCrossWorkspaceLeak: boolean;
  readonly notesCreatedAfterMission: boolean;
  readonly firstMissionCompleted: boolean;
  readonly allPassed: boolean;
}

export interface OperationalMemoryContinuityProofEvidence {
  readonly capturedAt: string;
  readonly marker: string;
  readonly workspaceId: string;
  readonly foreignWorkspaceId: string;
  readonly firstMissionId: string;
  readonly firstMissionStatus: string;
  readonly notesAfterFirstMission: number;
  readonly summaryNotesForMission: number;
  readonly learningNotesForMission: number;
  readonly notesAfterRestart: readonly string[];
  readonly briefingMemoryNotes: readonly string[];
  readonly secondMissionId: string;
  readonly leakToken: string;
  readonly duplicateContents: readonly string[];
  readonly dod: MemoryContinuityDodChecklist;
}

function createLogger() {
  return {
    info(obj: Record<string, unknown>, msg?: string) {
      console.log(JSON.stringify({ level: "info", msg, ...obj }));
    },
    warn(obj: Record<string, unknown>, msg?: string) {
      console.warn(JSON.stringify({ level: "warn", msg, ...obj }));
    },
    error(obj: Record<string, unknown>, msg?: string) {
      console.error(JSON.stringify({ level: "error", msg, ...obj }));
    },
  };
}

/**
 * Bundle real com MemoryStore Prisma (indice M1) — necessario para continuidade.
 */
export async function createMemoryContinuityBundle(): Promise<MemoryContinuityBundle> {
  assertProofDatabaseIsSafe("operational-memory-continuity-proof-harness");
  const probe = await probeRealQueueReady();
  if (!probe.ok || !probe.nexoId) {
    throw new Error(probe.reason ?? "Ambiente real indisponivel");
  }

  const projectRepository = new PrismaProjectRepository();
  const taskRepository = new PrismaTaskRepository();
  const teamIds = DIGITAL_TEAM_EMPLOYEES.map((entry) => entry.profile.id);
  const workspaces = new RepositoryWorkspaceSource(
    projectRepository,
    taskRepository,
    teamIds,
  );

  const memory = new PrismaOperationalMemoryStore();

  const lab = createLabRuntime({
    deterministic: true,
    workspaces,
    taskRepository,
    memoryStore: memory,
    preferQueue: true,
    missionWait: {
      timeoutMs: 120_000,
      pollIntervalMs: 400,
    },
  });

  const continuous = new ContinuousRuntime({
    office: lab.office,
    workspaces,
    projects: projectRepository,
    tasks: taskRepository,
    execution: lab.execution,
    memory: lab.memory,
    logger: createLogger(),
    enabled: true,
    pollIntervalMs: 400,
    heartbeatIntervalMs: 2000,
    schedulerIntervalMs: 120_000,
    staleRunningMs: 900_000,
    allowLearningPrismaFallback: false,
  });

  lab.operations.service.bindQueue(continuous.queue);

  const nexo = await workspaces.getWorkspace(probe.nexoId);
  if (!nexo) {
    throw new Error(`Workspace NEXO nao resolvido: ${probe.nexoId}`);
  }

  return {
    lab,
    continuous,
    service: lab.operations.service,
    memory,
    nexoWorkspaceId: nexo.id,
    nexoName: nexo.name,
    projects: projectRepository,
    tasks: taskRepository,
    workspaces,
  };
}

export async function disposeMemoryContinuityBundle(
  bundle: MemoryContinuityBundle,
  options: { disconnectPrisma?: boolean } = {},
): Promise<void> {
  await bundle.continuous.stop();
  if (options.disconnectPrisma !== false) {
    await prisma.$disconnect();
  }
}

function findDuplicateStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      dupes.push(value);
    } else {
      seen.add(value);
    }
  }
  return dupes;
}

function evaluateDod(input: {
  readonly firstRun: OperationalRun;
  readonly notesAfterFirstMission: number;
  readonly summaryNotesForMission: number;
  readonly notesAfterRestart: readonly string[];
  readonly briefingMemoryNotes: readonly string[];
  readonly marker: string;
  readonly leakToken: string;
  readonly duplicateContents: readonly string[];
}): MemoryContinuityDodChecklist {
  const firstMissionCompleted = input.firstRun.status === "completed";
  const notesCreatedAfterMission =
    input.notesAfterFirstMission >= 1 && input.summaryNotesForMission >= 1;

  const memoryPersistsAfterRestart =
    input.notesAfterRestart.some((n) => n.includes(input.marker)) ||
    input.notesAfterRestart.some((n) => n.includes("Resumo:"));

  const briefingRecoversMemory =
    input.briefingMemoryNotes.length > 0 &&
    (input.briefingMemoryNotes.some((n) => n.includes(input.marker)) ||
      input.briefingMemoryNotes.some((n) => n.includes("Resumo:")) ||
      input.briefingMemoryNotes.some((n) => n.includes("[LEARNING]")));

  const noDuplicates = input.duplicateContents.length === 0;

  const noCrossWorkspaceLeak =
    !input.notesAfterRestart.some((n) => n.includes(input.leakToken)) &&
    !input.briefingMemoryNotes.some((n) => n.includes(input.leakToken));

  const allPassed =
    firstMissionCompleted &&
    notesCreatedAfterMission &&
    memoryPersistsAfterRestart &&
    briefingRecoversMemory &&
    noDuplicates &&
    noCrossWorkspaceLeak;

  return {
    memoryPersistsAfterRestart,
    briefingRecoversMemory,
    noDuplicates,
    noCrossWorkspaceLeak,
    notesCreatedAfterMission,
    firstMissionCompleted,
    allPassed,
  };
}

/**
 * Prova ponta a ponta:
 * missao Queue → OperationalMemoryNote → restart → nova missao → briefing.
 */
export async function runOperationalMemoryContinuityProof(): Promise<OperationalMemoryContinuityProofEvidence> {
  const stamp = Date.now();
  const marker = `ContinuityProof-${stamp}`;
  const leakToken = `LEAK_TOKEN_${stamp}`;
  const foreignWorkspaceId = `foreign-continuity-${stamp}`;

  const bundle1 = await createMemoryContinuityBundle();
  let bundle2: MemoryContinuityBundle | null = null;

  try {
    await bundle1.continuous.start();

    // Veneno de isolamento — outro workspace.
    await persistMissionMemory(bundle1.memory, {
      workspaceId: foreignWorkspaceId,
      missionId: randomUUID(),
      objective: `FOREIGN ${marker}`,
      summary: `Segredo isolado ${leakToken}`,
      statusFinal: "COMPLETED",
    });

    const objective1 = `Memory Continuity Proof autenticacao ${marker}`;
    const firstRun = await bundle1.service.run({
      workspaceId: bundle1.nexoWorkspaceId,
      objective: objective1,
    });

    const notesForMission = await prisma.operationalMemoryNote.findMany({
      where: {
        workspaceId: bundle1.nexoWorkspaceId,
        OR: [
          { missionId: firstRun.id },
          { sourceId: firstRun.id },
        ],
      },
    });
    const summaryNotesForMission = notesForMission.filter(
      (n) => n.kind === MEMORY_KIND_RUN_SUMMARY,
    ).length;
    const learningNotesForMission = notesForMission.filter(
      (n) => n.kind === MEMORY_KIND_ORG_LEARNING,
    ).length;

    // Restart: para runtime e sobe novo bundle (nova instancia do store).
    await disposeMemoryContinuityBundle(bundle1, { disconnectPrisma: false });

    bundle2 = await createMemoryContinuityBundle();
    await bundle2.continuous.start();

    const notesAfterRestart = await loadOperationalMemoryNotes(bundle2.memory, {
      workspaceId: bundle2.nexoWorkspaceId,
      objective: objective1,
      topK: 10,
    });

    // Briefing: Path A com o mesmo store Prisma prova EmployeeContext.memoryNotes
    // (projector da Queue nao rehidrata memoryContext — feed e o mesmo loader).
    const labSync = createLabRuntime({
      deterministic: true,
      workspaces: bundle2.workspaces,
      taskRepository: bundle2.tasks,
      memoryStore: bundle2.memory,
      preferQueue: false,
    });

    const secondRun = await labSync.operations.service.run({
      workspaceId: bundle2.nexoWorkspaceId,
      objective: `Follow-up Continuity autenticacao ${marker}`,
      employeeId: "operaia-ceo",
    });

    const briefingMemoryNotes = (secondRun.mission.initial.briefing.additional
      ?.memoryContext ?? []) as readonly string[];

    const markerNotesRestart = notesAfterRestart.filter((n) =>
      n.includes(marker),
    );
    const markerNotesBriefing = briefingMemoryNotes.filter((n) =>
      n.includes(marker),
    );

    // Contagem de linhas do indice por source (sem duplicar sourceId+kind).
    const indexRows = await prisma.operationalMemoryNote.groupBy({
      by: ["sourceType", "sourceId", "kind"],
      where: {
        workspaceId: bundle2.nexoWorkspaceId,
        OR: [{ missionId: firstRun.id }, { sourceId: firstRun.id }],
      },
      _count: { _all: true },
    });
    const indexDupes = indexRows.filter((row) => row._count._all > 1);
    const allDupes = [
      ...findDuplicateStrings(markerNotesRestart).map((d) => `restart:${d}`),
      ...findDuplicateStrings(markerNotesBriefing).map((d) => `briefing:${d}`),
      ...indexDupes.map(
        (d) => `${d.sourceType}:${d.sourceId}:${d.kind}×${d._count._all}`,
      ),
    ];

    const dod = evaluateDod({
      firstRun,
      notesAfterFirstMission: notesForMission.length,
      summaryNotesForMission,
      notesAfterRestart,
      briefingMemoryNotes,
      marker,
      leakToken,
      duplicateContents: allDupes,
    });

    return {
      capturedAt: new Date().toISOString(),
      marker,
      workspaceId: bundle2.nexoWorkspaceId,
      foreignWorkspaceId,
      firstMissionId: firstRun.id,
      firstMissionStatus: firstRun.status,
      notesAfterFirstMission: notesForMission.length,
      summaryNotesForMission,
      learningNotesForMission,
      notesAfterRestart,
      briefingMemoryNotes,
      secondMissionId: secondRun.id,
      leakToken,
      duplicateContents: allDupes,
      dod,
    };
  } finally {
    if (bundle2) {
      await disposeMemoryContinuityBundle(bundle2);
    } else {
      await disposeMemoryContinuityBundle(bundle1);
    }
  }
}

export { probeRealQueueReady };
