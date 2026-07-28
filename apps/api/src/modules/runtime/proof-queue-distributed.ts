/**
 * Evidencia — missao distribuida via Mission Queue (Fase Final).
 *
 * Uso:
 *   pnpm --filter @operaia/api ops:queue-proof
 *
 * LLM = deterministic (sem chave). Postgres obrigatorio (seed NEXO).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Specialization } from "@operaia/employee-framework";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { prisma } from "@operaia/database";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { createLabRuntime } from "../operations/lab-runtime.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { ContinuousRuntime } from "./continuous-runtime.js";
import { MissionKind } from "./mission-states.js";
import type { ConsolidatePhaseResult } from "./mission-result-store.js";

const POLL_MS = 400;
const TIMEOUT_MS = 120_000;

const PARALLEL_SPECIALIZATIONS: readonly Specialization[] = [
  Specialization.SOFTWARE_ENGINEERING,
  Specialization.PRODUCT_DESIGN,
  Specialization.MARKETING,
  Specialization.LEGAL,
];

async function main(): Promise<void> {
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
    pollIntervalMs: 500,
    heartbeatIntervalMs: 2000,
    schedulerIntervalMs: 60_000,
    staleRunningMs: 900_000,
  });

  console.log("=== OperaIA.lab — Prova Mission Queue distribuida ===\n");
  await continuous.start();

  const nexo = await prisma.project.findFirst({ where: { name: "NEXO" } });
  if (!nexo) {
    throw new Error("Projeto NEXO nao encontrado. Rode: pnpm db:seed");
  }

  const objective =
    "Plano integrado NEXO: autenticacao, design UX, campanha marketing e revisao LGPD.";

  const { mission: root } = await continuous.queue.enqueue({
    workspaceId: nexo.id,
    projectId: nexo.id,
    objective,
    dedupe: false,
    missionKind: MissionKind.COORDINATE,
  });

  console.log(`Raiz COORDINATE enfileirada: ${root.id}`);
  console.log(`Objetivo: ${objective}\n`);

  await waitUntil(
    async () => {
      const current = await continuous.queue.get(root.id);
      return current?.status === "WAITING" || current?.status === "COMPLETED";
    },
    "coordenacao",
  );

  const rootAfterCoord = await continuous.queue.get(root.id);
  if (!rootAfterCoord) {
    throw new Error("Raiz desapareceu");
  }

  if (rootAfterCoord.status === "WAITING") {
    await ensureParallelExecutions(
      continuous,
      lab.office.matcher,
      rootAfterCoord.id,
      nexo.id,
      objective,
    );
  }

  await waitUntil(async () => {
    const current = await continuous.queue.get(root.id);
    return current?.status === "COMPLETED";
  }, "consolidacao");

  const tree = await continuous.queue.listTree({ take: 5 });
  const workers = continuous.workers.list();
  const rootFinal = await continuous.queue.get(root.id);
  const events = await prisma.missionEvent.findMany({
    where: { missionId: root.id },
    orderBy: { createdAt: "asc" },
  });
  const allEvents = await prisma.missionEvent.findMany({
    where: {
      missionId: {
        in: await collectTreeIds(root.id),
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const consolidated = rootFinal?.resultJson as ConsolidatePhaseResult | null;
  const executeChildren = await prisma.mission.findMany({
    where: {
      parentMissionId: root.id,
      missionKind: "EXECUTE",
    },
  });

  const evidence = {
    capturedAt: new Date().toISOString(),
    rootMissionId: root.id,
    workspaceId: nexo.id,
    objective,
    workers: workers.map((worker) => ({
      employeeId: worker.employeeId,
      name: worker.name,
      specialization: worker.specialization,
      status: worker.status,
      currentMissionId: worker.currentMissionId,
      heartbeatAt: worker.heartbeatAt,
      missionsCompleted: worker.missionsCompleted,
      missionsFailed: worker.missionsFailed,
      retries: worker.retries,
      lastExecutionAt: worker.lastExecutionAt,
      avgDurationMs: worker.avgDurationMs,
    })),
    workersAlive: continuous.workers.aliveCount(),
    tree,
    executeMissions: executeChildren.map((child) => ({
      id: child.id,
      specialization: child.requiredSpecialization,
      ownerEmployeeId: child.ownerEmployeeId,
      status: child.status,
      startedAt: child.startedAt?.toISOString(),
      finishedAt: child.finishedAt?.toISOString(),
      durationMs:
        child.startedAt && child.finishedAt
          ? child.finishedAt.getTime() - child.startedAt.getTime()
          : null,
    })),
    distinctEmployees: [
      ...new Set([
        "operaia-ceo",
        ...executeChildren.map((child) => child.ownerEmployeeId),
      ]),
    ],
    consolidatedResult: consolidated?.usableResult ?? null,
    rootEvents: events,
    allEvents,
  };

  console.log("\n--- GET /api/v1/workers (equivalente) ---\n");
  console.log(
    JSON.stringify(
      { workers: evidence.workers, alive: evidence.workersAlive },
      null,
      2,
    ),
  );

  console.log("\n--- GET /api/v1/missions?format=tree ---\n");
  console.log(JSON.stringify({ tree: evidence.tree }, null, 2));

  console.log("\n--- Resultado consolidado (Opera) ---\n");
  console.log(evidence.consolidatedResult ?? "(vazio)");

  console.log("\n--- Employees na missao ---\n");
  console.log(evidence.distinctEmployees.join(", "));

  const opsDir = resolve(process.cwd(), ".ops");
  await mkdir(opsDir, { recursive: true });
  const outPath = resolve(opsDir, "last-queue-distributed.json");
  await writeFile(outPath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`\nEvidencia salva em: ${outPath}`);

  await continuous.stop();
}

async function ensureParallelExecutions(
  continuous: ContinuousRuntime,
  matcher: { match: (spec: Specialization) => { profile: { id: string } } | undefined },
  rootId: string,
  workspaceId: string,
  objective: string,
): Promise<void> {
  const existing = await prisma.mission.findMany({
    where: { parentMissionId: rootId, missionKind: "EXECUTE" },
  });
  const covered = new Set(
    existing.map((mission) => mission.requiredSpecialization),
  );

  for (const specialization of PARALLEL_SPECIALIZATIONS) {
    if (covered.has(specialization)) {
      continue;
    }
    const matched = matcher.match(specialization);
    const { mission } = await continuous.queue.enqueue({
      workspaceId,
      projectId: workspaceId,
      objective: `[${specialization}] ${objective}`,
      parentMissionId: rootId,
      missionKind: MissionKind.EXECUTE,
      requiredSpecialization: specialization,
      ownerEmployeeId: matched?.profile.id ?? "unmatched",
      dedupe: false,
    });
    console.log(
      `EXECUTE complementar enfileirado: ${mission.id} (${specialization})`,
    );
  }
}

async function collectTreeIds(rootId: string): Promise<string[]> {
  const ids: string[] = [rootId];
  const children = await prisma.mission.findMany({
    where: { parentMissionId: rootId },
  });
  for (const child of children) {
    ids.push(child.id, ...(await collectTreeIds(child.id)));
  }
  return ids;
}

async function waitUntil(
  predicate: () => Promise<boolean>,
  label: string,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    if (await predicate()) {
      return;
    }
    await sleep(POLL_MS);
  }
  throw new Error(`Timeout aguardando: ${label}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

main().catch(async (error: unknown) => {
  console.error("Falha na prova da fila:", error);
  process.exitCode = 1;
});
