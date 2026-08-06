import type { DomainSignalService } from "@operaia/domain-signals";
import type { MemoryStore } from "@operaia/memory";
import {
  InMemoryAlertBus,
  OperationalHealthService,
  OperationalMaintenance,
} from "@operaia/operational-health";
import type { DigitalOffice } from "../../employees/office-composition.js";
import type { WorkspaceSource } from "../../employees/workspace-source.js";
import type { MissionExecutionStack } from "../../operations/mission-execution.js";
import type { EmployeeWorkerLogger } from "../employee-worker.js";
import type { MissionScheduler } from "../mission-scheduler.js";
import type { MissionQueue } from "../mission-queue.js";
import { SignalDecisionEngine } from "../signal-decision-engine.js";
import type { WorkerManager } from "../worker-manager.js";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import {
  FetchGithubRepoClient,
  type GithubRepoClient,
} from "./github-repo-client.js";
import { GitHubRepositoryScanner } from "./github-repository-scanner.js";
import type { GithubSnapshotStore } from "./github-snapshot-store.js";
import { HealthMonitor } from "./health-monitor.js";
import { InMemorySnapshotStore } from "./infrastructure/in-memory-snapshot-store.js";
import { MissionQueueAdapter } from "./infrastructure/mission-queue-adapter.js";
import {
  InMemoryOperationalEventStore,
  PersistingSupervisorLogger,
  type OperationalEventStorePort,
} from "./infrastructure/operational-event-store.js";
import { PrismaGithubSnapshotStore } from "./infrastructure/prisma-github-snapshot-store.js";
import { MissionScanner } from "./mission-scanner.js";
import type {
  ClockPort,
  HealthCheckPort,
  LearningStatsPort,
  SnapshotStorePort,
  SupervisorLoggerPort,
} from "./ports.js";
import { QueueMonitor } from "./queue-monitor.js";
import { RecoveryCoordinator } from "./recovery-coordinator.js";
import { SnapshotGenerator } from "./snapshot-generator.js";
import { StructuredSupervisorLogger } from "./structured-logger.js";
import { SupervisorLoop } from "./supervisor-loop.js";
import { WorkspaceScanner } from "./workspace-scanner.js";
import {
  PrismaLedgerMaintenance,
  PrismaMemoryMaintenance,
  PrismaOperationalMetricsProvider,
  PrismaQueueMaintenance,
} from "../operational-hardening-adapters.js";

export interface CreateOperationalSupervisorInput {
  readonly office: DigitalOffice;
  readonly workspaces: WorkspaceSource;
  readonly queue: MissionQueue;
  readonly workers: WorkerManager;
  readonly execution: MissionExecutionStack;
  readonly memory: MemoryStore;
  readonly scheduler: MissionScheduler;
  readonly learningStats: LearningStatsPort;
  readonly intervalMs: number;
  readonly staleRunningMs: number;
  readonly logger?: EmployeeWorkerLogger;
  readonly snapshotStore?: SnapshotStorePort;
  readonly eventStore?: OperationalEventStorePort;
  readonly clock?: ClockPort;
  readonly supervisorLogger?: SupervisorLoggerPort;
  /** Domain signals — habilita GitHubRepositoryScanner no ciclo. */
  readonly domainSignals?: DomainSignalService;
  readonly githubToken?: string | null;
  readonly githubRepoClient?: GithubRepoClient;
  readonly githubSnapshotStore?: GithubSnapshotStore;
  readonly githubRepositoryScanner?: GitHubRepositoryScanner;
  readonly signalDecisionEngine?: SignalDecisionEngine;
  /** A.5.3 — override; default Prisma metrics + maintenance. */
  readonly operationalHealth?: OperationalHealthService;
  readonly operationalMaintenance?: OperationalMaintenance;
  readonly disableOperationalHardening?: boolean;
}

export interface OperationalSupervisorBundle {
  readonly supervisor: SupervisorLoop;
  readonly eventStore: OperationalEventStorePort;
  readonly operationalHealth: OperationalHealthService;
  readonly operationalMaintenance: OperationalMaintenance;
  readonly alertBus: InMemoryAlertBus;
}

/**
 * Composition / DI do Operational Supervisor v2.
 * Sem regras de negocio: observa, detecta, agenda, recupera, dispara ciclos.
 */
export function createOperationalSupervisor(
  input: CreateOperationalSupervisorInput,
): OperationalSupervisorBundle {
  const clock: ClockPort = input.clock ?? { now: () => new Date() };
  const queuePort = new MissionQueueAdapter(input.queue);
  const eventStore = input.eventStore ?? new InMemoryOperationalEventStore();

  const consoleLogger =
    input.supervisorLogger ??
    new StructuredSupervisorLogger((level, payload) => {
      const sink = input.logger;
      if (!sink) {
        return;
      }
      if (level === "error") {
        sink.error(payload as Record<string, unknown>);
        return;
      }
      if (level === "warn") {
        sink.warn(payload as Record<string, unknown>);
        return;
      }
      sink.info(payload as Record<string, unknown>);
    });

  const supervisorLogger = new PersistingSupervisorLogger(
    eventStore,
    consoleLogger,
  );

  const workerPort = {
    list: () =>
      input.workers.list().map((w) => ({
        employeeId: w.employeeId,
        status: w.status,
      })),
    aliveCount: () => input.workers.aliveCount(),
  };

  const githubRepositoryScanner =
    input.githubRepositoryScanner ??
    (input.domainSignals
      ? new GitHubRepositoryScanner({
          signals: input.domainSignals,
          client:
            input.githubRepoClient ??
            new FetchGithubRepoClient({ token: input.githubToken }),
          snapshots:
            input.githubSnapshotStore ?? new PrismaGithubSnapshotStore(),
          clock,
        })
      : undefined);

  const signalDecisionEngine =
    input.signalDecisionEngine ??
    (input.domainSignals
      ? new SignalDecisionEngine({
          signals: input.domainSignals,
          queue: input.queue,
        })
      : undefined);

  const alertBus = new InMemoryAlertBus();
  const operationalHealth =
    input.operationalHealth ??
    new OperationalHealthService({
      alertBus,
      workspaceId: "nexo",
      emitAlerts: !input.disableOperationalHardening,
      metrics: input.disableOperationalHardening
        ? {
            collect: () => ({
              memoryActiveNotes: 0,
              memoryQuota: 2000,
              queueWaiting: 0,
              queueDepth: 0,
              consecutiveFailed: 0,
              workersAlive: input.workers.aliveCount(),
              workersExpected: input.workers.list().length,
              runtimeOk: true,
              schedulerRunning: true,
              actionsOk: true,
            }),
          }
        : new PrismaOperationalMetricsProvider({
            workspaceId: "nexo",
            workersAlive: () => input.workers.aliveCount(),
            workersExpected: () => input.workers.list().length,
            schedulerRunning: () => true,
            runtimeOk: () => true,
          }),
    });
  const operationalMaintenance =
    input.operationalMaintenance ??
    (input.disableOperationalHardening
      ? new OperationalMaintenance({})
      : new OperationalMaintenance({
          workspaceId: "nexo",
          memoryTargetActiveMax: 1_600,
          ledgerRetentionDays: 30,
          memory: new PrismaMemoryMaintenance("nexo"),
          queue: new PrismaQueueMaintenance(),
          ledger: new PrismaLedgerMaintenance(),
        }));

  const supervisor = new SupervisorLoop({
    healthMonitor: new HealthMonitor(buildHealthChecks(input), clock),
    workspaceScanner: new WorkspaceScanner(
      input.workspaces,
      queuePort,
      clock,
    ),
    missionScanner: new MissionScanner(
      queuePort,
      clock,
      input.staleRunningMs,
    ),
    queueMonitor: new QueueMonitor(
      queuePort,
      workerPort,
      clock,
      input.staleRunningMs,
    ),
    recoveryCoordinator: new RecoveryCoordinator(
      queuePort,
      supervisorLogger,
      clock,
      input.staleRunningMs,
    ),
    coordinationDispatcher: new CoordinationDispatcher(
      queuePort,
      supervisorLogger,
    ),
    snapshots: new SnapshotGenerator(clock),
    snapshotStore: input.snapshotStore ?? new InMemorySnapshotStore(),
    logger: supervisorLogger,
    intervalMs: input.intervalMs,
    staleRunningMs: input.staleRunningMs,
    githubRepositoryScanner,
    signalDecisionEngine,
    operationalHealth: input.disableOperationalHardening
      ? undefined
      : operationalHealth,
    operationalMaintenance: input.disableOperationalHardening
      ? undefined
      : operationalMaintenance,
    maintenanceEveryCycles: 5,
  });

  return {
    supervisor,
    eventStore,
    operationalHealth,
    operationalMaintenance,
    alertBus,
  };
}

function buildHealthChecks(
  input: CreateOperationalSupervisorInput,
): readonly HealthCheckPort[] {
  return [
    {
      name: "registry",
      async check() {
        const count = input.office.registry.all().length;
        return count > 0
          ? { status: "ok", detail: `${count} employees` }
          : { status: "fail", detail: "registry vazio" };
      },
    },
    {
      name: "runtime",
      async check() {
        const ok = Boolean(input.office.runner && input.office.matcher);
        return ok
          ? { status: "ok", detail: "employee-runtime ok" }
          : { status: "fail", detail: "runtime incompleto" };
      },
    },
    {
      name: "memory",
      async check() {
        return input.memory
          ? { status: "ok", detail: "MemoryStore disponível" }
          : { status: "fail", detail: "MemoryStore ausente" };
      },
    },
    {
      name: "queue",
      async check() {
        const depths = await input.queue.depths();
        return {
          status: "ok",
          detail: `q=${depths.queued} r=${depths.running} w=${depths.waiting} f=${depths.failed}`,
        };
      },
    },
    {
      name: "execution-engine",
      async check() {
        return input.execution?.engine
          ? { status: "ok", detail: "Execution stack presente" }
          : { status: "degraded", detail: "Execution stack parcial" };
      },
    },
    {
      name: "mission-engine",
      async check() {
        // Presence check only — Supervisor never invokes MissionScheduler.
        return input.scheduler
          ? { status: "ok", detail: "MissionScheduler disponivel para Opera" }
          : { status: "fail", detail: "mission engine ausente" };
      },
    },
    {
      name: "llm",
      async check() {
        return input.office.llm
          ? { status: "ok", detail: "LLM provider presente" }
          : { status: "fail", detail: "LLM ausente" };
      },
    },
    {
      name: "workspace-source",
      async check() {
        const list = await input.workspaces.listWorkspaces();
        return { status: "ok", detail: `${list.length} workspace(s)` };
      },
    },
    {
      name: "database",
      async check() {
        try {
          await input.learningStats.count();
          return { status: "ok", detail: "learning stats reachable" };
        } catch (error) {
          return {
            status: "fail",
            detail: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },
  ];
}
