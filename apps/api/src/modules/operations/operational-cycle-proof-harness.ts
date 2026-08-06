/**
 * Operational Cycle Proof — evidencia do ciclo oficial via Mission Queue.
 * Sem funcionalidades novas: reusa Lab + ContinuousRuntime + rotas HTTP existentes.
 *
 * Fora de escopo: memoria M1/M2/M3.
 */
import "./ensure-database-url.js";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { prisma } from "@operaia/database";
import { MissionOrchestrator } from "../employees/mission-orchestrator.js";
import { createEmployeeRoutes } from "../employees/employees.routes.js";
import type { ConsolidatePhaseResult } from "../runtime/mission-result-store.js";
import { CEO_EMPLOYEE_ID } from "../runtime/mission-states.js";
import { createOperationsRoutes } from "./operations.routes.js";
import {
  type RealAssistedQueueBundle,
} from "./assisted-queue-real-harness.js";

export const EXPECTED_WORKER_COUNT = DIGITAL_TEAM_EMPLOYEES.length;

export interface RuntimeBootEvidence {
  readonly continuousStarted: boolean;
  readonly workersAlive: number;
  readonly workersExpected: number;
  readonly supervisorRunning: boolean;
  readonly readinessCanStartWorkers: boolean;
  readonly preferQueue: boolean;
}

export interface CycleMissionEvidence {
  readonly entry: "ask" | "operations";
  readonly objective: string;
  readonly rootMissionId: string;
  readonly rootStatus: string;
  readonly rootOwnerEmployeeId: string | null;
  readonly missionKind: string;
  readonly rootHasInitial: boolean;
  readonly rootHasFinal: boolean;
  readonly usableResultLength: number;
  readonly executeChildren: readonly {
    readonly id: string;
    readonly status: string;
    readonly ownerEmployeeId: string;
  }[];
  readonly consolidateChildren: readonly {
    readonly id: string;
    readonly status: string;
  }[];
  readonly eventTypes: readonly string[];
  readonly orchestratorCalled: boolean;
  readonly httpStatusCode?: number;
}

export interface OperationalCycleProofEvidence {
  readonly capturedAt: string;
  readonly boot: RuntimeBootEvidence;
  readonly ask: CycleMissionEvidence;
  readonly operations: CycleMissionEvidence;
  readonly missionPersistsInPrismaAfterCycle: boolean;
  readonly operationalRunPresentInStore: boolean;
  readonly dod: OperationalCycleDodChecklist;
}

export interface OperationalCycleDodChecklist {
  readonly continuousRuntimeBoot: boolean;
  readonly workersConsuming: boolean;
  readonly supervisorActive: boolean;
  readonly askFullCycle: boolean;
  readonly operationsFullCycle: boolean;
  readonly missionEventsRegistered: boolean;
  readonly resultJsonHasFinal: boolean;
  readonly missionCompleted: boolean;
  readonly pathANotUsed: boolean;
  readonly allPassed: boolean;
}

function isFullCycle(evidence: CycleMissionEvidence): boolean {
  return (
    evidence.rootStatus === "COMPLETED" &&
    evidence.missionKind === "COORDINATE" &&
    evidence.rootOwnerEmployeeId === CEO_EMPLOYEE_ID &&
    evidence.rootHasInitial &&
    evidence.rootHasFinal &&
    evidence.executeChildren.length > 0 &&
    evidence.executeChildren.every((c) => c.status === "COMPLETED") &&
    evidence.consolidateChildren.some((c) => c.status === "COMPLETED") &&
    evidence.usableResultLength > 0 &&
    !evidence.orchestratorCalled
  );
}

function evaluateDod(input: {
  readonly boot: RuntimeBootEvidence;
  readonly ask: CycleMissionEvidence;
  readonly operations: CycleMissionEvidence;
}): OperationalCycleDodChecklist {
  const continuousRuntimeBoot =
    input.boot.continuousStarted &&
    input.boot.readinessCanStartWorkers &&
    input.boot.preferQueue;
  const workersConsuming =
    input.boot.workersAlive === input.boot.workersExpected &&
    input.boot.workersAlive >= 1;
  const supervisorActive = input.boot.supervisorRunning;
  const askFullCycle = isFullCycle(input.ask);
  const operationsFullCycle = isFullCycle(input.operations);
  const missionEventsRegistered =
    input.ask.eventTypes.some((t) =>
      ["enqueued", "claimed", "waiting", "completed"].includes(t),
    ) &&
    input.operations.eventTypes.some((t) =>
      ["enqueued", "claimed", "waiting", "completed"].includes(t),
    );
  const resultJsonHasFinal =
    input.ask.rootHasFinal && input.operations.rootHasFinal;
  const missionCompleted =
    input.ask.rootStatus === "COMPLETED" &&
    input.operations.rootStatus === "COMPLETED";
  const pathANotUsed =
    !input.ask.orchestratorCalled && !input.operations.orchestratorCalled;

  const allPassed =
    continuousRuntimeBoot &&
    workersConsuming &&
    supervisorActive &&
    askFullCycle &&
    operationsFullCycle &&
    missionEventsRegistered &&
    resultJsonHasFinal &&
    missionCompleted &&
    pathANotUsed;

  return {
    continuousRuntimeBoot,
    workersConsuming,
    supervisorActive,
    askFullCycle,
    operationsFullCycle,
    missionEventsRegistered,
    resultJsonHasFinal,
    missionCompleted,
    pathANotUsed,
    allPassed,
  };
}

async function collectMissionEvidence(input: {
  readonly entry: "ask" | "operations";
  readonly objective: string;
  readonly rootMissionId: string;
  readonly usableResultLength: number;
  readonly orchestratorCalled: boolean;
  readonly httpStatusCode?: number;
}): Promise<CycleMissionEvidence> {
  const root = await prisma.mission.findUniqueOrThrow({
    where: { id: input.rootMissionId },
  });
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
  const consolidated = root.resultJson as ConsolidatePhaseResult | null;

  return {
    entry: input.entry,
    objective: input.objective,
    rootMissionId: root.id,
    rootStatus: root.status,
    rootOwnerEmployeeId: root.ownerEmployeeId,
    missionKind: root.missionKind,
    rootHasInitial: Boolean(consolidated?.initial),
    rootHasFinal: Boolean(consolidated?.final),
    usableResultLength: input.usableResultLength,
    executeChildren: executeChildren.map((child) => ({
      id: child.id,
      status: child.status,
      ownerEmployeeId: child.ownerEmployeeId,
    })),
    consolidateChildren: consolidateChildren.map((child) => ({
      id: child.id,
      status: child.status,
    })),
    eventTypes: events.map((event) => event.type),
    orchestratorCalled: input.orchestratorCalled,
    ...(input.httpStatusCode !== undefined
      ? { httpStatusCode: input.httpStatusCode }
      : {}),
  };
}

async function withOrchestratorSpy<T>(
  run: () => Promise<T>,
): Promise<{ readonly result: T; readonly orchestratorCalled: boolean }> {
  let orchestratorCalled = false;
  const originalRun = MissionOrchestrator.prototype.run;
  MissionOrchestrator.prototype.run = async function (...args) {
    orchestratorCalled = true;
    return originalRun.apply(this, args);
  };
  try {
    const result = await run();
    return { result, orchestratorCalled };
  } finally {
    MissionOrchestrator.prototype.run = originalRun;
  }
}

export async function captureRuntimeBoot(
  bundle: RealAssistedQueueBundle,
): Promise<RuntimeBootEvidence> {
  await bundle.continuous.start();
  const snap = await bundle.continuous.snapshot();
  const readiness = bundle.continuous.getLastReadiness();

  return {
    continuousStarted: snap.started === true,
    workersAlive: snap.workersAlive,
    workersExpected: EXPECTED_WORKER_COUNT,
    supervisorRunning: snap.supervisor.running === true,
    readinessCanStartWorkers: readiness?.canStartWorkers === true,
    preferQueue: bundle.service.prefersQueue,
  };
}

/**
 * Monta Fastify minimo com as mesmas rotas de produto (employees + operations).
 */
export async function buildOperationalCycleHttpApp(
  bundle: RealAssistedQueueBundle,
) {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(createEmployeeRoutes(bundle.lab.team), {
    prefix: "/api/v1/employees",
  });
  await app.register(createOperationsRoutes(bundle.lab.operations), {
    prefix: "/api/v1/operations",
  });
  await app.ready();
  return app;
}

export async function runAskCycleViaHttp(input: {
  readonly bundle: RealAssistedQueueBundle;
  readonly app: Awaited<ReturnType<typeof buildOperationalCycleHttpApp>>;
  readonly objective: string;
}): Promise<CycleMissionEvidence> {
  const { result, orchestratorCalled } = await withOrchestratorSpy(async () => {
    const response = await input.app.inject({
      method: "POST",
      url: `/api/v1/employees/${CEO_EMPLOYEE_ID}/ask`,
      payload: {
        workspaceId: input.bundle.nexoWorkspaceId,
        question: input.objective,
      },
    });
    return response;
  });

  if (result.statusCode !== 200) {
    throw new Error(
      `POST /employees/:id/ask falhou: ${result.statusCode} ${result.body}`,
    );
  }

  const body = result.json() as {
    answer: { summary: string };
  };

const root = await prisma.mission.findFirst({
  where: {
    workspaceId: input.bundle.nexoWorkspaceId,
    missionKind: "COORDINATE",
    objective: {
      contains: input.objective,
    },
  },
  orderBy: {
    createdAt: "desc",
  },
});

if (!root) {
  throw new Error(
    `Mission COORDINATE nao encontrada apos ask (objective=${input.objective})`,
  );
}

return collectMissionEvidence({
  entry: "ask",
  objective: input.objective,
  rootMissionId: root.id,
  usableResultLength: body.answer.summary.length,
  orchestratorCalled,
  httpStatusCode: result.statusCode,
});
}

export async function runOperationsCycleViaHttp(input: {
  readonly bundle: RealAssistedQueueBundle;
  readonly app: Awaited<ReturnType<typeof buildOperationalCycleHttpApp>>;
  readonly objective: string;
}): Promise<CycleMissionEvidence> {
  const { result, orchestratorCalled } = await withOrchestratorSpy(async () => {
    const response = await input.app.inject({
      method: "POST",
      url: "/api/v1/operations/missions",
      payload: {
        workspaceId: input.bundle.nexoWorkspaceId,
        objective: input.objective,
      },
    });
    return response;
  });

  if (result.statusCode !== 201 && result.statusCode !== 202) {
    throw new Error(
      `POST /operations/missions falhou: ${result.statusCode} ${result.body}`,
    );
  }

  const body = result.json() as {
    id: string;
    status: string;
    usableResult: string;
  };

  return collectMissionEvidence({
    entry: "operations",
    objective: input.objective,
    rootMissionId: body.id,
    usableResultLength: body.usableResult.length,
    orchestratorCalled,
    httpStatusCode: result.statusCode,
  });
}

/**
 * Prova ponta a ponta: boot → ask HTTP → operations HTTP → DoD.
 */
export async function runOperationalCycleProof(
  bundle: RealAssistedQueueBundle,
): Promise<OperationalCycleProofEvidence> {
  const boot = await captureRuntimeBoot(bundle);
  const app = await buildOperationalCycleHttpApp(bundle);

  try {
    const stamp = Date.now();
    const askObjective = `Operational Cycle Proof ask autenticacao ${stamp}`;
    const operationsObjective = `Operational Cycle Proof operations autenticacao ${stamp}`;

    const ask = await runAskCycleViaHttp({
      bundle,
      app,
      objective: askObjective,
    });
    const operations = await runOperationsCycleViaHttp({
      bundle,
      app,
      objective: operationsObjective,
    });

    const askRoot = await prisma.mission.findUnique({
      where: { id: ask.rootMissionId },
    });
    const opsRoot = await prisma.mission.findUnique({
      where: { id: operations.rootMissionId },
    });
    const opsRunInStore = bundle.service.get(operations.rootMissionId);

    const dod = evaluateDod({ boot, ask, operations });

    return {
      capturedAt: new Date().toISOString(),
      boot,
      ask,
      operations,
      missionPersistsInPrismaAfterCycle: Boolean(askRoot) && Boolean(opsRoot),
      operationalRunPresentInStore: opsRunInStore !== undefined,
      dod,
    };
  } finally {
    await app.close();
  }
}

export {
  createRealAssistedQueueBundle,
  disposeRealAssistedQueueBundle,
  probeRealQueueReady,
  type RealAssistedQueueBundle,
} from "./assisted-queue-real-harness.js";
