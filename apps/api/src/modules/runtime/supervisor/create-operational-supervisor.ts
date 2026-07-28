import type { MemoryStore } from "@operaia/memory";
import type { DigitalOffice } from "../../employees/office-composition.js";
import type { WorkspaceSource } from "../../employees/workspace-source.js";
import type { MissionExecutionStack } from "../../operations/mission-execution.js";
import type { EmployeeWorkerLogger } from "../employee-worker.js";
import type { MissionScheduler } from "../mission-scheduler.js";
import type { MissionQueue } from "../mission-queue.js";
import type { WorkerManager } from "../worker-manager.js";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import { HealthMonitor } from "./health-monitor.js";
import { InMemorySnapshotStore } from "./infrastructure/in-memory-snapshot-store.js";
import { MissionQueueAdapter } from "./infrastructure/mission-queue-adapter.js";
import {
  InMemoryOperationalEventStore,
  PersistingSupervisorLogger,
  type OperationalEventStorePort,
} from "./infrastructure/operational-event-store.js";
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
}

export interface OperationalSupervisorBundle {
  readonly supervisor: SupervisorLoop;
  readonly eventStore: OperationalEventStorePort;
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
  });

  return { supervisor, eventStore };
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
        try {
          await input.memory.search({ text: "health", topK: 1 });
          return { status: "ok", detail: "MemoryStore.search ok" };
        } catch (error) {
          return {
            status: "fail",
            detail: error instanceof Error ? error.message : String(error),
          };
        }
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
