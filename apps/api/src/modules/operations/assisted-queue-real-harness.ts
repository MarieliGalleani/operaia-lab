/**
 * Harness real (sem mocks): Lab + ContinuousRuntime + preferQueue.
 * Usado pelo proof CLI e pelo teste de integracao Fase 2.2c.
 */
import "./ensure-database-url.js";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { prisma } from "@operaia/database";
import { MissionOrchestrator } from "../employees/mission-orchestrator.js";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import { CEO_EMPLOYEE_ID } from "../runtime/mission-states.js";
import type { ConsolidatePhaseResult } from "../runtime/mission-result-store.js";
import { createLabRuntime, type LabRuntime } from "./lab-runtime.js";
import type { OperationalRun } from "./operational-run.js";
import type { OperationalMissionService } from "./operational-mission-service.js";

export interface RealAssistedQueueBundle {
  readonly lab: LabRuntime;
  readonly continuous: ContinuousRuntime;
  readonly service: OperationalMissionService;
  readonly nexoWorkspaceId: string;
  readonly nexoName: string;
}

export interface RealAssistedQueueEvidence {
  readonly capturedAt: string;
  readonly rootMissionId: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly orchestratorCalled: boolean;
  readonly rootStatus: string;
  readonly rootOwnerEmployeeId: string | null;
  readonly rootHasInitial: boolean;
  readonly rootHasFinal: boolean;
  readonly executeChildren: readonly {
    readonly id: string;
    readonly status: string;
    readonly ownerEmployeeId: string;
    readonly requiredSpecialization: string | null;
  }[];
  readonly consolidateChildren: readonly {
    readonly id: string;
    readonly status: string;
  }[];
  readonly eventTypes: readonly string[];
  readonly learningOnRoot: boolean;
  readonly memoryHits: number;
  readonly operationalRun: {
    readonly id: string;
    readonly status: string;
    readonly usableResult: string;
    readonly replySummary: string;
    readonly outcomeCount: number;
    readonly specialistIds: readonly string[];
  };
}

export async function probeRealQueueReady(): Promise<{
  readonly ok: boolean;
  readonly reason?: string;
  readonly nexoId?: string;
}> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, reason: "DATABASE_URL ausente" };
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    return {
      ok: false,
      reason: `Postgres inacessivel: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const nexo = await prisma.project.findFirst({ where: { name: "NEXO" } });
  if (!nexo) {
    return { ok: false, reason: "Projeto NEXO nao encontrado (rode pnpm db:seed)" };
  }
  return { ok: true, nexoId: nexo.id };
}

export async function createRealAssistedQueueBundle(): Promise<RealAssistedQueueBundle> {
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

  const lab = createLabRuntime({
    deterministic: true,
    workspaces,
    taskRepository,
    preferQueue: true,
    missionWait: {
      timeoutMs: 120_000,
      pollIntervalMs: 400,
    },
  });

  const logger = {
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

  const continuous = new ContinuousRuntime({
    office: lab.office,
    workspaces,
    projects: projectRepository,
    tasks: taskRepository,
    execution: lab.execution,
    memory: lab.memory,
    logger,
    enabled: true,
    pollIntervalMs: 400,
    heartbeatIntervalMs: 2000,
    schedulerIntervalMs: 60_000,
    staleRunningMs: 900_000,
  });

  lab.operations.service.bindQueue(continuous.queue);

  const nexo = await workspaces.getWorkspace(probe.nexoId);
  if (!nexo) {
    throw new Error(`Workspace NEXO nao resolvido: ${probe.nexoId}`);
  }

  // Garante backlog tecnico para o ciclo COORDINATE→EXECUTE (ambiente real pode
  // ter zerado pendencias). Generico por projectId — nao assume NEXO-only.
  await ensurePendingBacklog(taskRepository, nexo.projectId);

  return {
    lab,
    continuous,
    service: lab.operations.service,
    nexoWorkspaceId: nexo.id,
    nexoName: nexo.name,
  };
}

async function ensurePendingBacklog(
  tasks: PrismaTaskRepository,
  projectId: string,
): Promise<void> {
  const existing = await tasks.findAll({ projectId });
  const pending = existing.filter((task) => task.status !== "DONE");
  if (pending.length > 0) {
    return;
  }
  await tasks.create({
    projectId,
    title: `assisted-proof-pending ${Date.now()}`,
    status: "TODO",
    priority: "HIGH",
  });
}

export async function runAssistedMissionOnRealQueue(input: {
  readonly bundle: RealAssistedQueueBundle;
  readonly objective: string;
}): Promise<{
  readonly run: OperationalRun;
  readonly evidence: RealAssistedQueueEvidence;
  readonly orchestratorCalled: boolean;
}> {
  const { bundle, objective } = input;
  let orchestratorCalled = false;
  const originalRun = MissionOrchestrator.prototype.run;
  MissionOrchestrator.prototype.run = async function (...args) {
    orchestratorCalled = true;
    return originalRun.apply(this, args);
  };

  try {
    await bundle.continuous.start();
    if (bundle.continuous.workers.aliveCount() < 1) {
      throw new Error("ContinuousRuntime sem workers vivos apos start()");
    }

    const run = await bundle.service.run({
      workspaceId: bundle.nexoWorkspaceId,
      objective,
    });

    const root = await prisma.mission.findUnique({ where: { id: run.id } });
    if (!root) {
      throw new Error(`Mission Prisma nao encontrada para run.id=${run.id}`);
    }

    const children = await prisma.mission.findMany({
      where: { parentMissionId: root.id },
      orderBy: { createdAt: "asc" },
    });
    const executeChildren = children.filter((c) => c.missionKind === "EXECUTE");
    const consolidateChildren = children.filter(
      (c) => c.missionKind === "CONSOLIDATE",
    );

    const events = await prisma.missionEvent.findMany({
      where: {
        missionId: {
          in: [root.id, ...children.map((c) => c.id)],
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const learning = await prisma.missionLearning.findUnique({
      where: { missionId: root.id },
    });

    const memoryHits = await bundle.lab.memory.search({
      text: objective,
      topK: 10,
      filter: { workspaceId: bundle.nexoWorkspaceId },
    });

    const consolidated = root.resultJson as ConsolidatePhaseResult | null;

    const evidence: RealAssistedQueueEvidence = {
      capturedAt: new Date().toISOString(),
      rootMissionId: root.id,
      workspaceId: root.workspaceId,
      objective,
      orchestratorCalled,
      rootStatus: root.status,
      rootOwnerEmployeeId: root.ownerEmployeeId,
      rootHasInitial: Boolean(consolidated?.initial),
      rootHasFinal: Boolean(consolidated?.final),
      executeChildren: executeChildren.map((child) => ({
        id: child.id,
        status: child.status,
        ownerEmployeeId: child.ownerEmployeeId,
        requiredSpecialization: child.requiredSpecialization,
      })),
      consolidateChildren: consolidateChildren.map((child) => ({
        id: child.id,
        status: child.status,
      })),
      eventTypes: events.map((event) => event.type),
      learningOnRoot: learning !== null,
      memoryHits: memoryHits.length,
      operationalRun: {
        id: run.id,
        status: run.status,
        usableResult: run.usableResult,
        replySummary: run.reply.answer.summary,
        outcomeCount: run.mission.outcomes.length,
        specialistIds: run.mission.outcomes
          .map((o) => o.employeeId)
          .filter((id): id is string => Boolean(id)),
      },
    };

    return { run, evidence, orchestratorCalled };
  } finally {
    MissionOrchestrator.prototype.run = originalRun;
  }
}

export async function disposeRealAssistedQueueBundle(
  bundle: RealAssistedQueueBundle,
): Promise<void> {
  await bundle.continuous.stop();
  await prisma.$disconnect();
}

export { CEO_EMPLOYEE_ID };
