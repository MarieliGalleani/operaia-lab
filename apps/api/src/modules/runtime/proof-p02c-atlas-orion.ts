/**
 * P0.2C — Proof Atlas/Orion (contrato SpecialistBrain + tools READ-ONLY).
 *
 * Somente operaia_lab_proof. Nao inicia WorkerManager. Nao muta producao.
 *
 * Uso:
 *   DATABASE_URL=…/operaia_lab_proof pnpm --filter @operaia/api exec tsx \
 *     src/modules/runtime/proof-p02c-atlas-orion.ts
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { Specialization } from "@operaia/employee-framework";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { prisma, type Mission } from "@operaia/database";
import { isValidDelivery } from "./work-governance/valid-result.js";
import { assertProofDatabaseIsSafe } from "../operations/assert-proof-database-safe.js";
import { createLabRuntime } from "../operations/lab-runtime.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { createEmployeeToolsFactory } from "./github-employee-tools-factory.js";
import { MissionQueue } from "./mission-queue.js";
import { QueuedMissionExecutor } from "./queued-mission-executor.js";
import {
  FileInfrastructureLogSource,
  NodeInfrastructureFileSystem,
} from "@operaia/tool-runtime";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";

const STAMP = Date.now();
const WORKSPACE_ID = "operaia-lab";
const PARK_MS = 6 * 60 * 60 * 1000;
const FIXTURE_ROOT = resolve("/tmp", `operaia-p02c-proof-ws-${STAMP}`);

assertProofDatabaseIsSafe("proof-p02c-atlas-orion");

function writeFixtures(): void {
  mkdirSync(resolve(FIXTURE_ROOT, ".github/workflows"), { recursive: true });
  mkdirSync(resolve(FIXTURE_ROOT, "logs"), { recursive: true });
  writeFileSync(
    resolve(FIXTURE_ROOT, "docker-compose.yml"),
    "services:\n  api:\n    image: operaia-lab-api:proof\n",
    "utf8",
  );
  writeFileSync(
    resolve(FIXTURE_ROOT, "Caddyfile"),
    "lab.operaia.com.br {\n  reverse_proxy 127.0.0.1:3333\n}\n",
    "utf8",
  );
  writeFileSync(
    resolve(FIXTURE_ROOT, ".github/workflows/ci.yml"),
    "name: ci\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo proof\n",
    "utf8",
  );
  writeFileSync(
    resolve(FIXTURE_ROOT, "logs/api.log"),
    "line1 proof atlas/orion\nline2 worker alive\n",
    "utf8",
  );
}

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
      throw new Error(`claimById falhou: ${missionId}`);
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
          proof: "p02c-atlas-orion",
        },
      },
    });
    return updated;
  });
}

function summarizeDelivery(resultJson: unknown): {
  readonly type: string | null;
  readonly status: string | null;
  readonly evidenceSources: readonly string[];
  readonly findingsCount: number;
  readonly toolIds: readonly string[];
} {
  if (!resultJson || typeof resultJson !== "object") {
    return {
      type: null,
      status: null,
      evidenceSources: [],
      findingsCount: 0,
      toolIds: [],
    };
  }
  const root = resultJson as Record<string, unknown>;
  const delivery = root["delivery"] as Record<string, unknown> | undefined;
  const toolExecutions = root["toolExecutions"] as
    | readonly { toolId?: string }[]
    | undefined;
  const evidence = (delivery?.["evidence"] as readonly { source?: string }[]) ?? [];
  const findings = (delivery?.["findings"] as readonly unknown[]) ?? [];
  return {
    type: typeof delivery?.["type"] === "string" ? delivery["type"] : null,
    status: typeof delivery?.["status"] === "string" ? delivery["status"] : null,
    evidenceSources: evidence.map((e) => String(e.source ?? "")),
    findingsCount: findings.length,
    toolIds: (toolExecutions ?? [])
      .map((t) => t.toolId)
      .filter((id): id is string => typeof id === "string"),
  };
}

function assertNoMutatingTools(toolIds: readonly string[]): void {
  const forbidden = [
    "restart",
    "reload",
    "deploy",
    "delete",
    "write",
    "mutate",
  ];
  for (const id of toolIds) {
    const lower = id.toLowerCase();
    if (forbidden.some((f) => lower.includes(f))) {
      throw new Error(`Tool mutadora detectada no proof: ${id}`);
    }
  }
}

async function runExecuteProof(input: {
  readonly label: string;
  readonly employeeId: string;
  readonly specialization: string;
  readonly objective: string;
  readonly expectedDeliveryType: string;
  readonly expectedStatus: "DELIVERED" | "FAILED";
  readonly toolsFactory: ReturnType<typeof createEmployeeToolsFactory>;
  readonly queue: MissionQueue;
  readonly executor: QueuedMissionExecutor;
}): Promise<{
  readonly missionId: string;
  readonly parentId: string;
  readonly summary: ReturnType<typeof summarizeDelivery>;
  readonly governanceValidNonTechnical: boolean;
  readonly governanceValidTechnical: boolean;
}> {
  const { mission: parent } = await input.queue.enqueue({
    workspaceId: WORKSPACE_ID,
    objective: `P0.2C parent ${input.label} ${STAMP}`,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    missionKind: MissionKind.COORDINATE,
    dedupe: false,
    scheduledAt: new Date(Date.now() + PARK_MS),
  });

  // Parent fica parked — apenas ancora de contrato EXECUTE (sem WorkerManager).
  const { mission: child } = await input.queue.enqueue({
    workspaceId: WORKSPACE_ID,
    objective: input.objective,
    parentMissionId: parent.id,
    missionKind: MissionKind.EXECUTE,
    requiredSpecialization: input.specialization,
    ownerEmployeeId: input.employeeId,
    readiness: "READY",
    dedupe: false,
    scheduledAt: new Date(Date.now() + PARK_MS),
  });

  await unparkMission(child.id);
  const claimed = await claimById(
    child.id,
    input.employeeId,
    input.specialization,
  );
  await input.executor.execute(claimed, input.employeeId);

  const row = await prisma.mission.findUniqueOrThrow({ where: { id: child.id } });
  const summary = summarizeDelivery(row.resultJson);
  assertNoMutatingTools(summary.toolIds);

  if (summary.type !== input.expectedDeliveryType) {
    throw new Error(
      `${input.label}: delivery.type esperado ${input.expectedDeliveryType}, obtido ${summary.type}`,
    );
  }
  if (summary.status !== input.expectedStatus) {
    throw new Error(
      `${input.label}: delivery.status esperado ${input.expectedStatus}, obtido ${summary.status}`,
    );
  }
  if (summary.evidenceSources.length === 0) {
    throw new Error(`${input.label}: evidence vazia`);
  }

  const delivery = (row.resultJson as { delivery?: unknown })?.delivery;
  return {
    missionId: child.id,
    parentId: parent.id,
    summary,
    governanceValidNonTechnical: isValidDelivery(
      delivery as never,
      "generic",
    ),
    governanceValidTechnical: isValidDelivery(delivery as never, "technical"),
  };
}

async function main(): Promise<void> {
  writeFixtures();

  const projectRepository = new PrismaProjectRepository();
  const taskRepository = new PrismaTaskRepository();
  const teamIds = DIGITAL_TEAM_EMPLOYEES.map((e) => e.profile.id);
  const workspaces = new RepositoryWorkspaceSource(
    projectRepository,
    taskRepository,
    teamIds,
  );

  const workspace = await workspaces.getWorkspace(WORKSPACE_ID);
  if (!workspace) {
    throw new Error(`Workspace ${WORKSPACE_ID} ausente no proof DB`);
  }

  const lab = createLabRuntime({
    deterministic: true,
    workspaces,
    taskRepository,
    enableConsoleObservability: false,
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

  const queue = new MissionQueue();
  const executor = new QueuedMissionExecutor(
    lab.office,
    workspaces,
    queue,
    lab.execution,
    lab.memory,
    logger,
  );

  const journalLogs = new FileInfrastructureLogSource(
    new NodeInfrastructureFileSystem(),
    [
      {
        line: "proof journal line atlas/orion",
        timestamp: new Date().toISOString(),
      },
    ],
  );

  const okFactory = createEmployeeToolsFactory({
    workspaceInfraRoots: { [WORKSPACE_ID]: FIXTURE_ROOT },
    infraLogs: journalLogs,
  });
  executor.setToolsFactory(okFactory);

  const atlas = await runExecuteProof({
    label: "Atlas",
    employeeId: "atlas",
    specialization: Specialization.AUTOMATION,
    objective: `P0.2C Atlas inspecionar docker/caddy/logs ${STAMP}`,
    expectedDeliveryType: "automation_result",
    expectedStatus: "DELIVERED",
    toolsFactory: okFactory,
    queue,
    executor,
  });

  const orion = await runExecuteProof({
    label: "Orion",
    employeeId: "orion",
    specialization: Specialization.OPERATIONS,
    objective: `P0.2C Orion inspecionar logs/workflow ${STAMP}`,
    expectedDeliveryType: "operations_analysis",
    expectedStatus: "DELIVERED",
    toolsFactory: okFactory,
    queue,
    executor,
  });

  // Handoff: COORDINATE com [SOURCE_EXECUTE] consome delivery Atlas (F5).
  // Nao usa CONSOLIDATE aqui — parent parked nao tem resultJson parcial.
  const handoffObjective =
    `[SOURCE_EXECUTE:${atlas.missionId}] P0.2C handoff atlas ${STAMP}`;
  const { mission: handoff } = await queue.enqueue({
    workspaceId: WORKSPACE_ID,
    objective: handoffObjective,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    missionKind: MissionKind.COORDINATE,
    dedupe: false,
    scheduledAt: new Date(Date.now() + PARK_MS),
  });
  await unparkMission(handoff.id);
  const claimedHandoff = await claimById(
    handoff.id,
    CEO_EMPLOYEE_ID,
    "MANAGEMENT",
  );
  await executor.execute(claimedHandoff, CEO_EMPLOYEE_ID);
  const handoffRow = await prisma.mission.findUniqueOrThrow({
    where: { id: handoff.id },
  });
  const handoffSummary = summarizeDelivery(handoffRow.resultJson);
  if (handoffSummary.type !== "priority_recommendation") {
    throw new Error(
      `Handoff F5: esperado priority_recommendation, obtido ${handoffSummary.type}`,
    );
  }
  if (handoffSummary.status !== "DELIVERED") {
    throw new Error(`Handoff F5: esperado DELIVERED, obtido ${handoffSummary.status}`);
  }

  // Failure path: ToolContext sem root / adapter ausente → FAILED + evidence tecnica
  const failFactory = createEmployeeToolsFactory({
    workspaceInfraRoots: {},
    infraLogs: journalLogs,
  });
  executor.setToolsFactory(failFactory);
  const failure = await runExecuteProof({
    label: "Atlas-failure",
    employeeId: "atlas",
    specialization: Specialization.AUTOMATION,
    objective: `P0.2C Atlas failure path ${STAMP}`,
    expectedDeliveryType: "automation_result",
    expectedStatus: "FAILED",
    toolsFactory: failFactory,
    queue,
    executor,
  });

  const report = {
    proof: "p02c-atlas-orion",
    database: "operaia_lab_proof",
    fixtureRoot: FIXTURE_ROOT,
    atlas: {
      missionId: atlas.missionId,
      ...atlas.summary,
      governanceValidNonTechnical: atlas.governanceValidNonTechnical,
      governanceValidTechnical: atlas.governanceValidTechnical,
    },
    orion: {
      missionId: orion.missionId,
      ...orion.summary,
      governanceValidNonTechnical: orion.governanceValidNonTechnical,
      governanceValidTechnical: orion.governanceValidTechnical,
    },
    handoff: {
      missionId: handoff.id,
      status: handoffRow.status,
      delivery: handoffSummary,
    },
    failure: {
      missionId: failure.missionId,
      ...failure.summary,
    },
    mutatingToolsCalled: false,
    productionDbTouched: false,
  };

  console.log(JSON.stringify({ level: "info", msg: "P0.2C_PROOF_RESULT", ...report }, null, 2));

  try {
    rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  } catch {
    // ignore
  }
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
