/**
 * Validacao controlada F4 — JOB → EXECUCAO → ENTREGA (tool real).
 *
 * Caminho: MissionQueue.enqueue → claim (por id) → QueuedMissionExecutor
 * (mesmo executor dos Workers). Nao inicia segundo WorkerManager.
 *
 * Anti-corrida com systemd: missions da prova ficam com scheduledAt futuro
 * ate o harness liberar claim-by-id.
 *
 * Employee: cto-mag | Tool: readRepository (GitHub, read-only)
 */
import "../operations/ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "../operations/assert-proof-database-safe.js";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { DomainSignalService } from "@operaia/domain-signals";
import { prisma, type Mission } from "@operaia/database";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { createLabRuntime } from "../operations/lab-runtime.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { PrismaDomainSignalStore } from "../signals/prisma-domain-signal-store.js";
import { createEmployeeToolsFactory } from "./github-employee-tools-factory.js";
import { MissionQueue } from "./mission-queue.js";
import {
  QueuedMissionExecutor,
  TOOL_USED_MISSION_EVENT_TYPE,
} from "./queued-mission-executor.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";

const STAMP = Date.now();
/** Intent marker forca especialista mesmo sem backlog (A.4.2). */
const MARKER =
  `[MISSION_INTENT] TECH_IMPLEMENTATION|employee:cto-mag|confidence:0.95\n\n` +
  `F4-JOB-DELIVERY Implementar autenticacao repositorio ${STAMP}`;
const WORKSPACE_ID = "operaia-lab";
const PARK_MS = 6 * 60 * 60 * 1000;

assertProofDatabaseIsSafe("proof-f4-job-execution-delivery");

async function parkMission(missionId: string): Promise<void> {
  await prisma.mission.update({
    where: { id: missionId },
    data: { scheduledAt: new Date(Date.now() + PARK_MS) },
  });
}

async function unparkMission(missionId: string): Promise<void> {
  await prisma.mission.update({
    where: { id: missionId },
    data: { scheduledAt: new Date() },
  });
}

/**
 * Claim deterministico por id (mesmo contrato de ownership do MissionQueue.claim).
 * So para missions desta prova — nao altera arquitetura da fila.
 */
async function claimById(
  missionId: string,
  employeeId: string,
  specialization: string,
): Promise<Mission> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Mission[]>`
      SELECT * FROM missions
      WHERE id = ${missionId}
        AND status = 'QUEUED'::"MissionStatus"
        AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      throw new Error(
        `claimById falhou: ${missionId} nao esta QUEUED/disponivel (corrida com worker?)`,
      );
    }

    const updated = await tx.mission.update({
      where: { id: row.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempt: { increment: 1 },
        leaseVersion: { increment: 1 },
        progress: 10,
        ownerEmployeeId: employeeId,
      },
    });

    await tx.missionEvent.create({
      data: {
        missionId: updated.id,
        type: "claimed",
        message: `Claim por ${employeeId}`,
        payload: {
          employeeId,
          specialization,
          missionKind: updated.missionKind,
          leaseVersion: updated.leaseVersion,
          proof: "f4-job-execution-delivery",
        },
      },
    });

    return updated;
  });
}

async function waitFor(
  label: string,
  predicate: () => Promise<boolean>,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timeout aguardando: ${label}`);
}

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new Error("GITHUB_TOKEN ausente — necessario para readRepository real");
  }

  const projectRepository = new PrismaProjectRepository();
  const taskRepository = new PrismaTaskRepository();
  const teamIds = DIGITAL_TEAM_EMPLOYEES.map((entry) => entry.profile.id);
  const workspaces = new RepositoryWorkspaceSource(
    projectRepository,
    taskRepository,
    teamIds,
  );
  const signals = new DomainSignalService(new PrismaDomainSignalStore());

  const lab = createLabRuntime({
    deterministic: true,
    workspaces,
    taskRepository,
    enableConsoleObservability: false,
  });

  // Gate CEO exige pendingTitles > 0 (exceto intent marker).
  // Garante backlog tecnico no workspace da prova — padrao assisted-queue.
  const workspace = await workspaces.getWorkspace(WORKSPACE_ID);
  if (!workspace) {
    throw new Error(`Workspace ${WORKSPACE_ID} nao encontrado`);
  }
  const existingTasks = await taskRepository.findAll({
    projectId: workspace.projectId,
  });
  const pending = existingTasks.filter((task) => task.status !== "DONE");
  if (pending.length === 0) {
    await taskRepository.create({
      projectId: workspace.projectId,
      title: `F4-JOB-DELIVERY autenticacao ${Date.now()}`,
      status: "TODO",
      priority: "HIGH",
    });
  }

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

  const queue = new MissionQueue();
  const executor = new QueuedMissionExecutor(
    lab.office,
    workspaces,
    queue,
    lab.execution,
    lab.memory,
    logger,
  );
  executor.setToolsFactory(
    createEmployeeToolsFactory({
      signals,
      token,
      workspaceInfraRoots: {
        "operaia-lab": process.cwd(),
      },
    }),
  );

  const { mission: root } = await queue.enqueue({
    workspaceId: WORKSPACE_ID,
    objective: MARKER,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: false,
    scheduledAt: new Date(Date.now() + PARK_MS),
  });

  await unparkMission(root.id);
  const coord = await claimById(root.id, CEO_EMPLOYEE_ID, "MANAGEMENT");
  await executor.execute(coord, CEO_EMPLOYEE_ID);

  const children = await queue.listChildren(root.id);
  const executeChildren = children.filter(
    (child) => child.missionKind === MissionKind.EXECUTE,
  );
  for (const child of executeChildren) {
    await parkMission(child.id);
  }

  const magChild = executeChildren.find(
    (child) => child.ownerEmployeeId === "cto-mag",
  );
  if (!magChild) {
    throw new Error(
      `EXECUTE cto-mag nao criada. children=${executeChildren
        .map((c) => `${c.ownerEmployeeId}:${c.requiredSpecialization}`)
        .join(",")}`,
    );
  }

  // Garante READY se Mag ficou BLOCKED sem predecessor concluida (DAG).
  if (magChild.readiness === "BLOCKED") {
    const preds = await prisma.missionDependency.findMany({
      where: { missionId: magChild.id },
      include: { dependsOn: true },
    });
    const blockedByOpen = preds.some(
      (pred) =>
        pred.dependsOn.status !== "COMPLETED" &&
        pred.dependsOn.status !== "FAILED",
    );
    if (!blockedByOpen) {
      await prisma.mission.update({
        where: { id: magChild.id },
        data: { readiness: "READY" },
      });
    } else {
      // Executa predecessores primeiro (mesmo executor + tools).
      for (const pred of preds) {
        if (
          pred.dependsOn.status === "QUEUED" ||
          pred.dependsOn.status === "CREATED"
        ) {
          await unparkMission(pred.dependsOnMissionId);
          if (pred.dependsOn.readiness !== "READY") {
            await prisma.mission.update({
              where: { id: pred.dependsOnMissionId },
              data: { readiness: "READY" },
            });
          }
          const claimedPred = await claimById(
            pred.dependsOnMissionId,
            pred.dependsOn.ownerEmployeeId,
            pred.dependsOn.requiredSpecialization ?? "SOFTWARE_ENGINEERING",
          );
          await executor.execute(
            claimedPred,
            pred.dependsOn.ownerEmployeeId,
          );
        }
      }
      await waitFor(
        "Mag READY apos predecessores",
        async () => {
          const row = await prisma.mission.findUniqueOrThrow({
            where: { id: magChild.id },
          });
          return row.readiness === "READY";
        },
        30_000,
      );
    }
  }

  await unparkMission(magChild.id);
  const executeClaim = await claimById(
    magChild.id,
    "cto-mag",
    "SOFTWARE_ENGINEERING",
  );
  await executor.execute(executeClaim, "cto-mag");

  // Libera irmãos para o runtime de producao (ou completa localmente se ainda QUEUED).
  const siblings = await prisma.mission.findMany({
    where: {
      parentMissionId: root.id,
      missionKind: "EXECUTE",
      id: { not: magChild.id },
      status: { in: ["QUEUED", "CREATED", "WAITING"] },
    },
  });
  for (const sibling of siblings) {
    await unparkMission(sibling.id);
    if (sibling.readiness === "BLOCKED") {
      continue;
    }
    if (sibling.status === "QUEUED" || sibling.status === "CREATED") {
      if (sibling.status === "CREATED") {
        await prisma.mission.update({
          where: { id: sibling.id },
          data: { status: "QUEUED" },
        });
      }
      try {
        const claimed = await claimById(
          sibling.id,
          sibling.ownerEmployeeId,
          sibling.requiredSpecialization ?? "UNKNOWN",
        );
        await executor.execute(claimed, sibling.ownerEmployeeId);
      } catch (error) {
        logger.warn(
          {
            siblingId: sibling.id,
            err: error instanceof Error ? error.message : String(error),
          },
          "irmao nao claimado localmente — aguardando worker",
        );
      }
    }
  }

  await waitFor(
    "todos EXECUTE terminal",
    async () => {
      const rows = await prisma.mission.findMany({
        where: { parentMissionId: root.id, missionKind: "EXECUTE" },
      });
      return rows.every(
        (row) => row.status === "COMPLETED" || row.status === "FAILED",
      );
    },
    180_000,
  );

  await waitFor(
    "CONSOLIDATE enfileirada",
    async () => {
      const row = await prisma.mission.findFirst({
        where: {
          parentMissionId: root.id,
          missionKind: "CONSOLIDATE",
        },
      });
      return Boolean(row);
    },
    60_000,
  );

  const consolidate = await prisma.mission.findFirstOrThrow({
    where: { parentMissionId: root.id, missionKind: "CONSOLIDATE" },
  });

  if (consolidate.status === "QUEUED") {
    await parkMission(consolidate.id);
    await unparkMission(consolidate.id);
    try {
      const consClaim = await claimById(
        consolidate.id,
        CEO_EMPLOYEE_ID,
        "MANAGEMENT",
      );
      await executor.execute(consClaim, CEO_EMPLOYEE_ID);
    } catch (error) {
      logger.warn(
        {
          consolidateId: consolidate.id,
          err: error instanceof Error ? error.message : String(error),
        },
        "CONSOLIDATE claim local falhou — aguardando worker",
      );
    }
  }

  await waitFor(
    "raiz COMPLETED",
    async () => {
      const row = await prisma.mission.findUniqueOrThrow({
        where: { id: root.id },
      });
      return row.status === "COMPLETED";
    },
    120_000,
  );

  const rootFinal = await prisma.mission.findUniqueOrThrow({
    where: { id: root.id },
  });
  const executeFinal = await prisma.mission.findUniqueOrThrow({
    where: { id: magChild.id },
  });
  const consolidateFinal = await prisma.mission.findUniqueOrThrow({
    where: { id: consolidate.id },
  });
  const toolEvents = await prisma.missionEvent.findMany({
    where: {
      missionId: magChild.id,
      type: TOOL_USED_MISSION_EVENT_TYPE,
    },
    orderBy: { createdAt: "asc" },
  });
  const trailEvents = await prisma.missionEvent.findMany({
    where: {
      missionId: { in: [root.id, magChild.id, consolidate.id] },
    },
    orderBy: { createdAt: "asc" },
  });

  const resultJson = executeFinal.resultJson as Record<string, unknown> | null;
  const toolExecutions = Array.isArray(resultJson?.toolExecutions)
    ? resultJson.toolExecutions
    : [];
  const firstTool = toolEvents[0];
  const payload =
    firstTool?.payload && typeof firstTool.payload === "object"
      ? (firstTool.payload as Record<string, unknown>)
      : {};

  const statusTrail = [
    "CREATED",
    "QUEUED",
    "CLAIMED",
    "RUNNING",
    "EXECUTED",
    "TOOL_USED",
    "DELIVERED",
    "CONSOLIDATED",
    "COMPLETED",
  ] as const;

  const ok =
    rootFinal.status === "COMPLETED" &&
    executeFinal.status === "COMPLETED" &&
    consolidateFinal.status === "COMPLETED" &&
    toolEvents.length >= 1 &&
    payload.success === true &&
    payload.toolId === "readRepository" &&
    toolExecutions.length >= 1 &&
    trailEvents.some((event) => event.type === "claimed") &&
    trailEvents.some((event) => event.type === TOOL_USED_MISSION_EVENT_TYPE);

  console.log(
    JSON.stringify(
      {
        ok,
        marker: MARKER,
        rootMissionId: root.id,
        executeMissionId: magChild.id,
        employeeId: "cto-mag",
        statusTrail: [...statusTrail],
        eventTypes: trailEvents.map((event) => event.type),
        toolExecution: {
          tool: payload.toolId ?? null,
          action: "readRepository",
          success: payload.success === true,
          outcome: payload.outcome ?? null,
          eventCount: toolEvents.length,
        },
        delivery: {
          persisted: toolEvents.length >= 1,
          missionResultJson: toolExecutions.length >= 1,
          missionEvent: toolEvents.length >= 1,
        },
        consolidation: {
          created: true,
          completed: consolidateFinal.status === "COMPLETED",
        },
        rootStatus: rootFinal.status,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
