/**
 * Operational Resilience Proof — evidencias de recovery/dedupe/reclaim.
 * Sem funcionalidades novas: usa MissionQueue + ContinuousRuntime + Supervisor existentes.
 *
 * Fora de escopo: memoria, remocao do Path A.
 */
import "./ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "./assert-proof-database-safe.js";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { prisma } from "@operaia/database";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import {
  hashObjective,
  MissionQueue,
} from "../runtime/mission-queue.js";
import { CEO_EMPLOYEE_ID } from "../runtime/mission-states.js";
import { createLabRuntime } from "./lab-runtime.js";
import {
  probeRealQueueReady,
  type RealAssistedQueueBundle,
} from "./assisted-queue-real-harness.js";

const OPEN_STATUSES = ["CREATED", "QUEUED", "RUNNING", "WAITING"] as const;

export interface ResilienceBundle extends RealAssistedQueueBundle {
  readonly queue: MissionQueue;
}

export interface RestartRecoveryEvidence {
  readonly missionId: string;
  readonly objective: string;
  readonly statusBeforeStop: string;
  readonly statusWhileDown: string;
  readonly duplicateCountWhileDown: number;
  readonly recoveredRunning: number;
  readonly statusAfterRecover: string;
  readonly recoveredEvent: boolean;
  readonly statusAfterReclaim: string;
  readonly claimedAfterRecover: boolean;
  readonly finalDuplicateCount: number;
  readonly workersAliveAfterRestart: number;
}

export interface SupervisorDedupeEvidence {
  readonly objective: string;
  readonly firstEnqueueCreated: boolean;
  readonly secondEnqueueCreated: boolean;
  readonly sameMissionId: boolean;
  readonly openCountAfterDoubleEnqueue: number;
  readonly cycle1Dispatched: number;
  readonly cycle2Dispatched: number;
  readonly openCountAfterCycles: number;
  readonly noDuplicateAfterCycles: boolean;
}

export interface WorkerFailureEvidence {
  readonly missionId: string;
  readonly statusForcedRunning: string;
  readonly recoveredCount: number;
  readonly statusAfterStaleRecover: string;
  readonly recoveredEvent: boolean;
  readonly failRequeued: boolean;
  readonly statusAfterFail: string;
  readonly requeuedEvent: boolean;
  readonly statusAfterReclaim: string;
  readonly claimedAfterRecover: boolean;
}

export interface OperationalResilienceDodChecklist {
  readonly restartNoDuplicate: boolean;
  readonly restartWorkerResumes: boolean;
  readonly restartFinalConsistent: boolean;
  readonly supervisorNoDuplicate: boolean;
  readonly workerStaleReclaim: boolean;
  readonly workerFailRequeue: boolean;
  readonly allPassed: boolean;
}

export interface OperationalResilienceProofEvidence {
  readonly capturedAt: string;
  readonly restart: RestartRecoveryEvidence;
  readonly supervisorDedupe: SupervisorDedupeEvidence;
  readonly workerFailure: WorkerFailureEvidence;
  readonly dod: OperationalResilienceDodChecklist;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countByObjective(input: {
  readonly workspaceId: string;
  readonly objective: string;
}): Promise<number> {
  const objectiveHash = hashObjective(input.workspaceId, input.objective);
  return prisma.mission.count({
    where: {
      workspaceId: input.workspaceId,
      objectiveHash,
      missionKind: "COORDINATE",
    },
  });
}

async function countOpenByObjective(input: {
  readonly workspaceId: string;
  readonly objective: string;
}): Promise<number> {
  const objectiveHash = hashObjective(input.workspaceId, input.objective);
  return prisma.mission.count({
    where: {
      workspaceId: input.workspaceId,
      objectiveHash,
      missionKind: "COORDINATE",
      status: { in: [...OPEN_STATUSES] },
    },
  });
}

async function eventTypesFor(missionId: string): Promise<string[]> {
  const events = await prisma.missionEvent.findMany({
    where: { missionId },
    orderBy: { createdAt: "asc" },
  });
  return events.map((e) => e.type);
}

/**
 * Forca RUNNING orfao (MQ-3): sem liveness de WorkerHeartbeat.
 * updatedAt antigo permanece so para observabilidade; reclaim usa heartbeat.
 */
async function forceOrphanRunning(missionId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE missions
    SET
      status = 'RUNNING'::"MissionStatus",
      "startedAt" = NOW() - INTERVAL '30 seconds',
      "updatedAt" = NOW() - INTERVAL '30 seconds',
      attempt = GREATEST(attempt, 1)
    WHERE id = ${missionId}
  `;
  const mission = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
  });
  const staleAt = new Date(Date.now() - 60_000);
  await prisma.workerHeartbeat.upsert({
    where: { employeeId: mission.ownerEmployeeId },
    create: {
      employeeId: mission.ownerEmployeeId,
      status: "stopped",
      currentMissionId: null,
      startedAt: staleAt,
      lastSeenAt: staleAt,
    },
    update: {
      status: "stopped",
      currentMissionId: null,
      lastSeenAt: staleAt,
    },
  });
}

async function waitForStatus(
  missionId: string,
  accepted: readonly string[],
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const mission = await prisma.mission.findUniqueOrThrow({
      where: { id: missionId },
    });
    if (accepted.includes(mission.status)) {
      return mission.status;
    }
    await sleep(200);
  }
  const last = await prisma.mission.findUniqueOrThrow({
    where: { id: missionId },
  });
  return last.status;
}

/**
 * Bundle real com staleRunningMs=0 para recovery no boot ser observavel.
 * Nao e feature nova — so config de ContinuousRuntime ja existente.
 */
export async function createResilienceQueueBundle(): Promise<ResilienceBundle> {
  assertProofDatabaseIsSafe("operational-resilience-proof-harness");
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
      timeoutMs: 60_000,
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
    // Intervalo alto: ciclos do Supervisor sob controle via runCycle().
    schedulerIntervalMs: 120_000,
    // 0 = todo RUNNING e candidato a recover no boot (prova de restart).
    staleRunningMs: 0,
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
    queue: continuous.queue,
    nexoWorkspaceId: nexo.id,
    nexoName: nexo.name,
  };
}

export async function disposeResilienceQueueBundle(
  bundle: ResilienceBundle,
): Promise<void> {
  await bundle.continuous.stop();
  await prisma.$disconnect();
}

/**
 * 1. Restart Recovery
 * Boot → stop → cria missao RUNNING orfã → start → recover + reclaim.
 * Runtime parado antes do seed evita corrida com workers.
 */
export async function runRestartRecoveryScenario(
  bundle: ResilienceBundle,
): Promise<RestartRecoveryEvidence> {
  const stamp = Date.now();
  const objective = `Resilience Restart Proof autenticacao ${stamp}`;

  await bundle.continuous.start();
  await bundle.continuous.stop();

  const { mission } = await bundle.queue.enqueue({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: false,
  });

  await forceOrphanRunning(mission.id);

  const mid = await prisma.mission.findUniqueOrThrow({
    where: { id: mission.id },
  });
  const whileDown = mid;
  const duplicateCountWhileDown = await countByObjective({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
  });

  // Reinicia runtime: recoverStaleRunning(0) no boot + workers reclamam.
  await bundle.continuous.start();
  const snap = await bundle.continuous.snapshot();

  const afterRecoverStatus = await waitForStatus(
    mission.id,
    ["QUEUED", "RUNNING", "WAITING", "COMPLETED"],
    15_000,
  );
  const eventsAfterBoot = await eventTypesFor(mission.id);
  const recoveredEvent = eventsAfterBoot.includes("recovered");

  const statusAfterReclaim = await waitForStatus(
    mission.id,
    ["RUNNING", "WAITING", "COMPLETED"],
    60_000,
  );
  const eventsFinal = await eventTypesFor(mission.id);
  const claimedAfterRecover =
    eventsFinal.includes("claimed") ||
    statusAfterReclaim === "COMPLETED" ||
    statusAfterReclaim === "WAITING" ||
    statusAfterReclaim === "RUNNING";

  const finalDuplicateCount = await countByObjective({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
  });

  return {
    missionId: mission.id,
    objective,
    statusBeforeStop: mid.status,
    statusWhileDown: whileDown.status,
    duplicateCountWhileDown,
    recoveredRunning: recoveredEvent ? 1 : 0,
    statusAfterRecover: afterRecoverStatus,
    recoveredEvent,
    statusAfterReclaim,
    claimedAfterRecover,
    finalDuplicateCount,
    workersAliveAfterRestart: snap.workersAlive,
  };
}

/**
 * 2. Supervisor Deduplication
 * enqueue duplicado + multiplos runCycle sem criar COORDINATE duplicada.
 */
export async function runSupervisorDedupeScenario(
  bundle: ResilienceBundle,
): Promise<SupervisorDedupeEvidence> {
  if (!bundle.continuous.enabled) {
    throw new Error("ContinuousRuntime precisa estar habilitado");
  }
  await bundle.continuous.start();

  const stamp = Date.now();
  const objective =
    `[COORDINATE/resilience_dedupe] Atencao operacional no workspace ${bundle.nexoWorkspaceId}. proof ${stamp}`;

  const first = await bundle.queue.enqueue({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: true,
  });
  const second = await bundle.queue.enqueue({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: true,
  });

  // Mantem OPEN (WAITING) para workers nao consumirem durante os ciclos —
  // senão COMPLETED sai de OPEN e o assert de "nao duplicou" fica ambiguo.
  await prisma.mission.update({
    where: { id: first.mission.id },
    data: {
      status: "WAITING",
      startedAt: null,
      lastError: "Resilience proof — pinned WAITING for dedupe assert",
    },
  });

  const openCountAfterDoubleEnqueue = await countOpenByObjective({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
  });

  const beforeCycles = openCountAfterDoubleEnqueue;
  const cycle1 = await bundle.continuous.supervisor.runCycle();
  const cycle2 = await bundle.continuous.supervisor.runCycle();

  const openCountAfterCycles = await countOpenByObjective({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
  });
  const totalAfterCycles = await countByObjective({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
  });

  // Mesmo objectiveHash: permanece 1 OPEN e 1 total (sem storm).
  const noDuplicateAfterCycles =
    openCountAfterCycles === beforeCycles &&
    openCountAfterCycles === 1 &&
    totalAfterCycles === 1;

  return {
    objective,
    firstEnqueueCreated: first.created,
    secondEnqueueCreated: second.created,
    sameMissionId: first.mission.id === second.mission.id,
    openCountAfterDoubleEnqueue,
    cycle1Dispatched: cycle1?.dispatch.dispatched ?? 0,
    cycle2Dispatched: cycle2?.dispatch.dispatched ?? 0,
    openCountAfterCycles,
    noDuplicateAfterCycles,
  };
}

/**
 * 3. Worker Failure — RUNNING orfao + fail/requeue + reclaim.
 */
export async function runWorkerFailureScenario(
  bundle: ResilienceBundle,
): Promise<WorkerFailureEvidence> {
  await bundle.continuous.stop();

  const stamp = Date.now();
  const objective = `Resilience Worker Failure Proof autenticacao ${stamp}`;
  const { mission } = await bundle.queue.enqueue({
    workspaceId: bundle.nexoWorkspaceId,
    objective,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: false,
  });

  await forceOrphanRunning(mission.id);
  const forced = await prisma.mission.findUniqueOrThrow({
    where: { id: mission.id },
  });

  const recoveredCount = await bundle.queue.recoverStaleRunning(0);
  const afterStale = await prisma.mission.findUniqueOrThrow({
    where: { id: mission.id },
  });
  const eventsAfterStale = await eventTypesFor(mission.id);

  // Simula falha do worker no meio: fail → requeue (attempt < maxAttempts).
  await forceOrphanRunning(mission.id);
  const beforeFail = await prisma.mission.findUniqueOrThrow({
    where: { id: mission.id },
  });
  const failed = await bundle.queue.fail(
    mission.id,
    "Resilience proof — worker interrompido",
    beforeFail.leaseVersion,
  );
  const eventsAfterFail = await eventTypesFor(mission.id);

  // fail() agenda backoff (5s * 2^(attempt-1)); libera claim imediato.
  await prisma.mission.update({
    where: { id: mission.id },
    data: { scheduledAt: new Date() },
  });

  await bundle.continuous.start();
  const statusAfterReclaim = await waitForStatus(
    mission.id,
    ["RUNNING", "WAITING", "COMPLETED"],
    60_000,
  );
  const eventsFinal = await eventTypesFor(mission.id);

  return {
    missionId: mission.id,
    statusForcedRunning: forced.status,
    recoveredCount,
    statusAfterStaleRecover: afterStale.status,
    recoveredEvent: eventsAfterStale.includes("recovered"),
    failRequeued: failed.status === "QUEUED",
    statusAfterFail: failed.status,
    requeuedEvent: eventsAfterFail.includes("requeued"),
    statusAfterReclaim,
    claimedAfterRecover: eventsFinal.includes("claimed"),
  };
}

function evaluateDod(input: {
  readonly restart: RestartRecoveryEvidence;
  readonly supervisorDedupe: SupervisorDedupeEvidence;
  readonly workerFailure: WorkerFailureEvidence;
}): OperationalResilienceDodChecklist {
  const restartNoDuplicate =
    input.restart.duplicateCountWhileDown === 1 &&
    input.restart.finalDuplicateCount === 1;
  const restartWorkerResumes =
    input.restart.recoveredEvent &&
    input.restart.workersAliveAfterRestart >= 1 &&
    input.restart.claimedAfterRecover;
  const restartFinalConsistent = ["RUNNING", "WAITING", "COMPLETED"].includes(
    input.restart.statusAfterReclaim,
  );

  const supervisorNoDuplicate =
    input.supervisorDedupe.firstEnqueueCreated &&
    !input.supervisorDedupe.secondEnqueueCreated &&
    input.supervisorDedupe.sameMissionId &&
    input.supervisorDedupe.openCountAfterDoubleEnqueue === 1 &&
    input.supervisorDedupe.noDuplicateAfterCycles;

  const workerStaleReclaim =
    input.workerFailure.recoveredCount >= 1 &&
    input.workerFailure.statusAfterStaleRecover === "QUEUED" &&
    input.workerFailure.recoveredEvent &&
    input.workerFailure.claimedAfterRecover &&
    ["RUNNING", "WAITING", "COMPLETED"].includes(
      input.workerFailure.statusAfterReclaim,
    );

  const workerFailRequeue =
    input.workerFailure.failRequeued && input.workerFailure.requeuedEvent;

  const allPassed =
    restartNoDuplicate &&
    restartWorkerResumes &&
    restartFinalConsistent &&
    supervisorNoDuplicate &&
    workerStaleReclaim &&
    workerFailRequeue;

  return {
    restartNoDuplicate,
    restartWorkerResumes,
    restartFinalConsistent,
    supervisorNoDuplicate,
    workerStaleReclaim,
    workerFailRequeue,
    allPassed,
  };
}

/**
 * Prova completa: restart → supervisor dedupe → worker failure → DoD.
 */
export async function runOperationalResilienceProof(
  bundle: ResilienceBundle,
): Promise<OperationalResilienceProofEvidence> {
  const restart = await runRestartRecoveryScenario(bundle);
  const supervisorDedupe = await runSupervisorDedupeScenario(bundle);
  const workerFailure = await runWorkerFailureScenario(bundle);
  const dod = evaluateDod({ restart, supervisorDedupe, workerFailure });

  return {
    capturedAt: new Date().toISOString(),
    restart,
    supervisorDedupe,
    workerFailure,
    dod,
  };
}

export { probeRealQueueReady };
