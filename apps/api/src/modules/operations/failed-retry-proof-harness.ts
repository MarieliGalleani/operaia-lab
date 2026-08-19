/**
 * F6.1 — prova real de retry de FAILED (Postgres isolado).
 */
import "./ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "./assert-proof-database-safe.js";
import { MissionStatus, prisma } from "@operaia/database";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import { MissionQueue } from "../runtime/mission-queue.js";
import { CEO_EMPLOYEE_ID } from "../runtime/mission-states.js";
import { MissionScanner } from "../runtime/supervisor/mission-scanner.js";
import { QueueMonitor } from "../runtime/supervisor/queue-monitor.js";
import { RecoveryCoordinator } from "../runtime/supervisor/recovery-coordinator.js";
import { MissionQueueAdapter } from "../runtime/supervisor/infrastructure/mission-queue-adapter.js";
import { WorkspaceScanner } from "../runtime/supervisor/workspace-scanner.js";
import { createLabRuntime } from "./lab-runtime.js";
import { probeRealQueueReady } from "./assisted-queue-real-harness.js";

export interface FailedRetryProofEvidence {
  readonly capturedAt: string;
  readonly retryableMissionId: string;
  readonly exhaustedMissionId: string;
  readonly initialStatus: string;
  readonly finalStatus: string;
  readonly initialAttempt: number;
  readonly finalAttempt: number;
  readonly maxAttempts: number;
  readonly duplicateMissionCount: number;
  readonly newCoordinateCount: number;
  readonly retryPassed: boolean;
  readonly exhaustedPassed: boolean;
  readonly workerReclaimed: boolean;
  readonly allPassed: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function forceFailed(input: {
  readonly missionId: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly error: string;
}): Promise<void> {
  await prisma.mission.update({
    where: { id: input.missionId },
    data: {
      status: MissionStatus.FAILED,
      attempt: input.attempt,
      maxAttempts: input.maxAttempts,
      finishedAt: new Date(),
      startedAt: null,
      progress: 100,
      lastError: input.error,
    },
  });
}

async function countByObjectivePrefix(
  workspaceId: string,
  prefix: string,
): Promise<number> {
  return prisma.mission.count({
    where: {
      workspaceId,
      objective: { startsWith: prefix },
    },
  });
}

export async function runFailedRetryProof(): Promise<FailedRetryProofEvidence> {
  assertProofDatabaseIsSafe("failed-retry-proof-harness");
  const probe = await probeRealQueueReady();
  if (!probe.ok || !probe.nexoId) {
    throw new Error(probe.reason ?? "Ambiente real indisponivel");
  }

  const stamp = Date.now();
  const retryObjective = `F6.1 retry proof ${stamp}`;
  const exhaustedObjective = `F6.1 exhausted proof ${stamp}`;
  const workspaceId = probe.nexoId;

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
    schedulerIntervalMs: 120_000,
    staleRunningMs: 900_000,
  });

  lab.operations.service.bindQueue(continuous.queue);

  const retryEnqueue = await queue.enqueue({
    workspaceId,
    objective: retryObjective,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: false,
    maxAttempts: 3,
  });
  const exhaustedEnqueue = await queue.enqueue({
    workspaceId,
    objective: exhaustedObjective,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: false,
    maxAttempts: 3,
  });

  await forceFailed({
    missionId: retryEnqueue.mission.id,
    attempt: 1,
    maxAttempts: 3,
    error: "proof forced failed retryable",
  });
  await forceFailed({
    missionId: exhaustedEnqueue.mission.id,
    attempt: 3,
    maxAttempts: 3,
    error: "proof forced failed exhausted",
  });

  const initialRetry = await prisma.mission.findUniqueOrThrow({
    where: { id: retryEnqueue.mission.id },
  });
  const initialExhausted = await prisma.mission.findUniqueOrThrow({
    where: { id: exhaustedEnqueue.mission.id },
  });
  void initialExhausted;

  const queuePort = new MissionQueueAdapter(queue);
  const clock = { now: () => new Date() };
  const missionScanner = new MissionScanner(queuePort, clock, 900_000);
  const missionsBefore = await missionScanner.scan();
  const { queue: queueReport } = await new QueueMonitor(
    queuePort,
    {
      list: () => continuous.workers.list().map((w) => ({
        employeeId: w.employeeId,
        status: w.status,
      })),
      aliveCount: () => continuous.workers.aliveCount(),
    },
    clock,
    900_000,
  ).scan();
  const workspaceReport = await new WorkspaceScanner(
    workspaces,
    queuePort,
    clock,
  ).scan();

  const recoveryLogger = {
    emit: () => {},
  };
  const recovery = await new RecoveryCoordinator(
    queuePort,
    recoveryLogger,
    clock,
    900_000,
  ).recover({
    missions: missionsBefore,
    queue: queueReport,
    workspaces: workspaceReport,
  });

  await recoveryCoordinatorSecondPass(queuePort, clock);

  const afterRetry = await prisma.mission.findUniqueOrThrow({
    where: { id: retryEnqueue.mission.id },
  });
  const afterExhausted = await prisma.mission.findUniqueOrThrow({
    where: { id: exhaustedEnqueue.mission.id },
  });

  const coordinateBeforeWorker = await prisma.mission.count({
    where: {
      workspaceId,
      missionKind: "COORDINATE",
      objective: { contains: String(stamp) },
    },
  });

  await continuous.start();
  const deadline = Date.now() + 60_000;
  let workerReclaimed = false;
  while (Date.now() < deadline) {
    const current = await prisma.mission.findUniqueOrThrow({
      where: { id: retryEnqueue.mission.id },
    });
    if (current.status === "RUNNING" || current.status === "COMPLETED") {
      workerReclaimed = true;
      break;
    }
    const events = await prisma.missionEvent.findMany({
      where: { missionId: retryEnqueue.mission.id, type: "claimed" },
    });
    if (events.length > 0) {
      workerReclaimed = true;
      break;
    }
    await sleep(400);
  }
  await continuous.stop();

  const newCoordinateCount = await prisma.mission.count({
    where: {
      workspaceId,
      missionKind: "COORDINATE",
      objective: { contains: String(stamp) },
    },
  });

  const duplicateMissionCount = await countByObjectivePrefix(
    workspaceId,
    `F6.1 retry proof ${stamp}`,
  );

  const retryPassed =
    recovery.actions.some((a) => a.kind === "failed_retry") &&
    afterRetry.status === "QUEUED" &&
    afterRetry.id === retryEnqueue.mission.id &&
    afterRetry.attempt === initialRetry.attempt;
  const exhaustedPassed = afterExhausted.status === "FAILED";

  const allPassed =
    retryPassed &&
    exhaustedPassed &&
    duplicateMissionCount === 1 &&
    newCoordinateCount === coordinateBeforeWorker &&
    workerReclaimed;

  return {
    capturedAt: new Date().toISOString(),
    retryableMissionId: retryEnqueue.mission.id,
    exhaustedMissionId: exhaustedEnqueue.mission.id,
    initialStatus: initialRetry.status,
    finalStatus: afterRetry.status,
    initialAttempt: initialRetry.attempt,
    finalAttempt: afterRetry.attempt,
    maxAttempts: initialRetry.maxAttempts,
    duplicateMissionCount,
    newCoordinateCount,
    retryPassed,
    exhaustedPassed,
    workerReclaimed,
    allPassed,
  };
}

async function recoveryCoordinatorSecondPass(
  queuePort: MissionQueueAdapter,
  clock: { now: () => Date },
): Promise<void> {
  const missions = await new MissionScanner(queuePort, clock, 900_000).scan();
  await new RecoveryCoordinator(
    queuePort,
    { emit: () => {} },
    clock,
    900_000,
  ).recover({
    missions,
    queue: {
      scannedAt: clock.now().toISOString(),
      depth: 0,
      congested: false,
      stuck: 0,
      waiting: 0,
      pending: 0,
      retry: 0,
      running: 0,
      failed: 0,
      workersAvailable: 0,
      workersBusy: 0,
      depths: { queued: 0, running: 0, waiting: 0, failed: 0 },
    },
    workspaces: {
      scannedAt: clock.now().toISOString(),
      workspaces: [],
      activeCount: 0,
      readyCount: 0,
      attentionCount: 0,
    },
  });
}
