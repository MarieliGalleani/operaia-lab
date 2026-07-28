import { describe, expect, it } from "vitest";
import { InMemoryWorkspaceSource } from "../../employees/in-memory-workspace-source.js";
import { buildTestWorkspaceCatalog } from "../../employees/test-workspace-catalog.js";
import { CEO_EMPLOYEE_ID } from "../mission-states.js";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import { HealthMonitor } from "./health-monitor.js";
import { InMemorySnapshotStore } from "./infrastructure/in-memory-snapshot-store.js";
import {
  InMemoryOperationalEventStore,
  PersistingSupervisorLogger,
} from "./infrastructure/operational-event-store.js";
import { MissionScanner } from "./mission-scanner.js";
import type {
  ClockPort,
  MissionQueuePort,
  MissionView,
  SupervisorLoggerPort,
} from "./ports.js";
import { QueueMonitor } from "./queue-monitor.js";
import { RecoveryCoordinator } from "./recovery-coordinator.js";
import { SnapshotGenerator } from "./snapshot-generator.js";
import { StructuredSupervisorLogger } from "./structured-logger.js";
import { SupervisorLoop } from "./supervisor-loop.js";
import type { WorkspaceScanReport } from "./types.js";
import { SupervisorEvent } from "./types.js";
import { WorkspaceScanner } from "./workspace-scanner.js";

const fixedNow = new Date("2026-07-28T16:00:00.000Z");
const clock: ClockPort = { now: () => fixedNow };

type EnqueuedMission = {
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly objective: string;
  readonly ownerEmployeeId: string;
  readonly priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  readonly dedupe?: boolean;
};

function mission(
  partial: Partial<MissionView> & Pick<MissionView, "id" | "status">,
): MissionView {
  return {
    workspaceId: "nexo",
    readiness: "READY",
    attempt: 0,
    maxAttempts: 3,
    updatedAt: fixedNow,
    startedAt: null,
    lastError: null,
    missionKind: "COORDINATE",
    ...partial,
  };
}

function createQueue(
  overrides: Partial<MissionQueuePort> & {
    readonly rows?: readonly MissionView[];
  } = {},
): MissionQueuePort & { enqueued: EnqueuedMission[] } {
  const rows = overrides.rows ?? [];
  const enqueued: EnqueuedMission[] = [];
  return {
    enqueued,
    async depths() {
      return {
        queued: rows.filter((r) => r.status === "QUEUED").length,
        running: rows.filter((r) => r.status === "RUNNING").length,
        waiting: rows.filter((r) => r.status === "WAITING").length,
        failed: rows.filter((r) => r.status === "FAILED").length,
      };
    },
    async list(filters) {
      if (!filters?.status) {
        return rows;
      }
      return rows.filter((r) => r.status === filters.status);
    },
    async recoverStaleRunning() {
      return 1;
    },
    async recoverWaitingParents() {
      return 1;
    },
    async recoverBlockedDag() {
      return 1;
    },
    async enqueue(input) {
      enqueued.push({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        objective: input.objective,
        ownerEmployeeId: input.ownerEmployeeId,
        priority: input.priority,
        dedupe: input.dedupe,
      });
      return { created: true, id: `coord-${enqueued.length}` };
    },
    ...overrides,
  };
}

function noopLogger(): SupervisorLoggerPort {
  return { emit() {} };
}

function emptyWorkspaceReport(): WorkspaceScanReport {
  return {
    scannedAt: fixedNow.toISOString(),
    workspaces: [
      {
        workspaceId: "nexo",
        name: "NEXO",
        status: "ACTIVE",
        projectId: "nexo",
        pendingTasks: 0,
        teamSize: 1,
        hasActiveMission: false,
        hasBlockedMission: false,
        hasWaitingMission: false,
        hasReadyMission: false,
        hasBacklog: false,
        hasChanges: false,
        needsAttention: false,
        attentionReasons: [],
        openMissions: 0,
        ready: true,
        issues: [],
      },
    ],
    activeCount: 1,
    readyCount: 1,
    attentionCount: 0,
  };
}

async function attentionWorkspaces(
  queue: MissionQueuePort,
): Promise<WorkspaceScanReport> {
  const workspaces = await new WorkspaceScanner(
    new InMemoryWorkspaceSource(buildTestWorkspaceCatalog()),
    queue,
    clock,
  ).scan();
  return {
    ...workspaces,
    attentionCount: 1,
    workspaces: workspaces.workspaces.map((w) =>
      w.workspaceId === "nexo"
        ? {
            ...w,
            needsAttention: true,
            attentionReasons: ["backlog" as const],
            hasBacklog: true,
            pendingTasks: 2,
          }
        : w,
    ),
  };
}

function emptyRecovery() {
  return {
    recoveredAt: fixedNow.toISOString(),
    actions: [] as const,
    infraRecovered: 0,
    coordinationsRequested: 0,
  };
}

describe("Operational Supervisor v2 — missao permanente", () => {
  it("health check registra componentes sem decidir", async () => {
    const monitor = new HealthMonitor(
      [
        {
          name: "registry",
          check: async () => ({ status: "ok", detail: "ok" }),
        },
        {
          name: "memory",
          check: async () => ({ status: "ok", detail: "ok" }),
        },
        {
          name: "queue",
          check: async () => ({ status: "degraded", detail: "slow" }),
        },
      ],
      clock,
    );
    const report = await monitor.run();
    expect(report.overall).toBe("degraded");
    expect(report.components).toHaveLength(3);
  });

  it("workspace novo/com backlog marca needsAttention e nao executa missao", async () => {
    const workspaces = new InMemoryWorkspaceSource(buildTestWorkspaceCatalog());
    const queue = createQueue({ rows: [] });
    const scanner = new WorkspaceScanner(workspaces, queue, clock);
    const report = await scanner.scan();
    const nexo = report.workspaces.find((w) => w.workspaceId === "nexo");
    expect(nexo).toBeDefined();
    expect(nexo!.hasBacklog || nexo!.needsAttention || nexo!.status === "ACTIVE").toBe(
      true,
    );
    expect(queue.enqueued).toHaveLength(0);
  });

  it("mission scan detecta blocked e stale", async () => {
    const queue = createQueue({
      rows: [
        mission({
          id: "b1",
          status: "QUEUED",
          readiness: "BLOCKED",
        }),
        mission({
          id: "s1",
          status: "RUNNING",
          startedAt: new Date(fixedNow.getTime() - 120_000),
          updatedAt: new Date(fixedNow.getTime() - 120_000),
        }),
        mission({ id: "f1", status: "FAILED", attempt: 1, maxAttempts: 3 }),
      ],
    });
    const scanner = new MissionScanner(queue, clock, 30_000);
    const report = await scanner.scan();
    expect(report.items.some((i) => i.category === "BLOCKED")).toBe(true);
    expect(report.items.some((i) => i.category === "STALE")).toBe(true);
    expect(report.items.some((i) => i.category === "RETRY")).toBe(true);
    expect(report.coordinationNeeded).toBeGreaterThan(0);
  });

  it("queue congestionada e workers disponiveis/ocupados", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      mission({ id: `q${i}`, status: "QUEUED" }),
    );
    const queue = createQueue({ rows: many });
    const monitor = new QueueMonitor(
      queue,
      {
        list: () => [
          { employeeId: "a", status: "idle" },
          { employeeId: "b", status: "busy" },
        ],
        aliveCount: () => 2,
      },
      clock,
      30_000,
      10,
    );
    const { queue: report, workers } = await monitor.scan();
    expect(report.congested).toBe(true);
    expect(report.depth).toBeGreaterThanOrEqual(10);
    expect(workers.available).toBe(1);
    expect(workers.busy).toBe(1);
  });

  it("recovery cria acoes e pede coordenacao", async () => {
    const events: string[] = [];
    const logger: SupervisorLoggerPort = {
      emit(event) {
        events.push(event);
      },
    };
    const queue = createQueue({
      rows: [
        mission({
          id: "s1",
          status: "RUNNING",
          updatedAt: new Date(fixedNow.getTime() - 60_000),
        }),
      ],
    });
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const { queue: queueReport } = await new QueueMonitor(
      queue,
      { list: () => [], aliveCount: () => 0 },
      clock,
      30_000,
    ).scan();
    const workspaces = await new WorkspaceScanner(
      new InMemoryWorkspaceSource(buildTestWorkspaceCatalog()),
      queue,
      clock,
    ).scan();

    const recovery = await new RecoveryCoordinator(
      queue,
      logger,
      clock,
      30_000,
    ).recover({ missions, queue: queueReport, workspaces });

    expect(recovery.infraRecovered).toBeGreaterThan(0);
    expect(events).toContain(SupervisorEvent.RECOVERY_CREATED);
  });

  it("coordination cria COORDINATE para Opera", async () => {
    const events: string[] = [];
    const logger: SupervisorLoggerPort = {
      emit(event) {
        events.push(event);
      },
    };
    const queue = createQueue({ rows: [] });
    const withAttention = await attentionWorkspaces(queue);
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const { queue: queueReport } = await new QueueMonitor(
      queue,
      { list: () => [], aliveCount: () => 0 },
      clock,
      30_000,
    ).scan();

    const dispatcher = new CoordinationDispatcher(queue, logger);
    const result = await dispatcher.dispatch({
      workspaces: withAttention,
      missions,
      queue: queueReport,
      recovery: emptyRecovery(),
      healthOk: true,
    });

    expect(result.dispatched).toBeGreaterThan(0);
    expect(queue.enqueued[0]?.objective).toContain("[COORDINATE/");
    expect(queue.enqueued[0]?.objective).toContain("nexo");
    expect(events).toContain(SupervisorEvent.COORDINATION_CREATED);
  });

  it("sem sinal operacional encerra ciclo sem criar missao nem chamar scheduler", async () => {
    const events: string[] = [];
    const logger: SupervisorLoggerPort = {
      emit(event) {
        events.push(event);
      },
    };
    const queue = createQueue({ rows: [] });
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const { queue: queueReport } = await new QueueMonitor(
      queue,
      { list: () => [], aliveCount: () => 0 },
      clock,
      30_000,
    ).scan();

    const result = await new CoordinationDispatcher(queue, logger).dispatch({
      workspaces: emptyWorkspaceReport(),
      missions,
      queue: { ...queueReport, congested: false },
      recovery: emptyRecovery(),
      healthOk: true,
    });

    expect(result.dispatched).toBe(0);
    expect(result.details).toContain("sem sinal operacional — ciclo encerrado");
    expect(queue.enqueued).toHaveLength(0);
    expect(events).not.toContain(SupervisorEvent.COORDINATION_CREATED);
  });

  it("loop completo funciona com eventos canonicos", async () => {
    const eventStore = new InMemoryOperationalEventStore();
    const emitted: string[] = [];
    const logger = new PersistingSupervisorLogger(
      eventStore,
      new StructuredSupervisorLogger((_l, p) => {
        emitted.push(String(p.event));
      }),
    );
    const queue = createQueue({
      rows: [
        mission({
          id: "blocked",
          status: "QUEUED",
          readiness: "BLOCKED",
        }),
      ],
    });
    const workspaces = new InMemoryWorkspaceSource(buildTestWorkspaceCatalog());

    const loop = new SupervisorLoop({
      healthMonitor: new HealthMonitor(
        [
          {
            name: "registry",
            check: async () => ({ status: "ok", detail: "ok" }),
          },
        ],
        clock,
      ),
      workspaceScanner: new WorkspaceScanner(workspaces, queue, clock),
      missionScanner: new MissionScanner(queue, clock, 30_000),
      queueMonitor: new QueueMonitor(
        queue,
        {
          list: () => [{ employeeId: "operaia-ceo", status: "idle" }],
          aliveCount: () => 1,
        },
        clock,
        30_000,
      ),
      recoveryCoordinator: new RecoveryCoordinator(
        queue,
        logger,
        clock,
        30_000,
      ),
      coordinationDispatcher: new CoordinationDispatcher(queue, logger),
      snapshots: new SnapshotGenerator(clock),
      snapshotStore: new InMemorySnapshotStore(),
      logger,
      intervalMs: 60_000,
      staleRunningMs: 30_000,
    });

    const ctx = await loop.runCycle();
    expect(ctx).not.toBeNull();
    expect(ctx!.cycle).toBe(1);
    expect(emitted).toContain(SupervisorEvent.HEALTH_CHECK);
    expect(emitted).toContain(SupervisorEvent.WORKSPACE_SCANNED);
    expect(emitted).toContain(SupervisorEvent.MISSION_SCANNED);
    expect(emitted).toContain(SupervisorEvent.QUEUE_SCANNED);
    expect(emitted).toContain(SupervisorEvent.SUPERVISOR_SLEEP);
  });
});

describe("Operational Supervisor — invariantes arquiteturais", () => {
  it("COORDINATE sempre tem ownerEmployeeId = Opera (CEO_EMPLOYEE_ID)", async () => {
    const queue = createQueue({ rows: [] });
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const { queue: queueReport } = await new QueueMonitor(
      queue,
      { list: () => [], aliveCount: () => 0 },
      clock,
      30_000,
    ).scan();

    await new CoordinationDispatcher(queue, noopLogger()).dispatch({
      workspaces: await attentionWorkspaces(queue),
      missions,
      queue: queueReport,
      recovery: emptyRecovery(),
      healthOk: true,
    });

    expect(queue.enqueued.length).toBeGreaterThan(0);
    for (const item of queue.enqueued) {
      expect(item.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
      expect(item.ownerEmployeeId).toBe("operaia-ceo");
    }
  });

  it("COORDINATE nunca define specialist, Employee alternativo ou prioridade de negocio", async () => {
    const queue = createQueue({ rows: [] });
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const { queue: queueReport } = await new QueueMonitor(
      queue,
      { list: () => [], aliveCount: () => 0 },
      clock,
      30_000,
    ).scan();

    await new CoordinationDispatcher(queue, noopLogger()).dispatch({
      workspaces: await attentionWorkspaces(queue),
      missions,
      queue: queueReport,
      recovery: emptyRecovery(),
      healthOk: true,
    });

    expect(queue.enqueued.length).toBeGreaterThan(0);
    for (const item of queue.enqueued) {
      expect(item.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
      expect(item.ownerEmployeeId).not.toBe("cto-mag");
      expect(item.priority).toBeUndefined();
      expect(item.objective).toMatch(/^\[COORDINATE\//);
      expect(item.objective.toLowerCase()).not.toContain("specialist");
      expect(item.objective.toLowerCase()).not.toContain("especialista");
      expect(Object.keys(item).sort()).toEqual(
        [
          "dedupe",
          "objective",
          "ownerEmployeeId",
          "priority",
          "projectId",
          "workspaceId",
        ].sort(),
      );
    }
  });

  it("Supervisor nao envia priority, portfolio nem estrategia de negocio no enqueue", async () => {
    const queue = createQueue({ rows: [] });
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const { queue: queueReport } = await new QueueMonitor(
      queue,
      { list: () => [], aliveCount: () => 0 },
      clock,
      30_000,
    ).scan();

    await new CoordinationDispatcher(queue, noopLogger()).dispatch({
      workspaces: await attentionWorkspaces(queue),
      missions,
      queue: queueReport,
      recovery: emptyRecovery(),
      healthOk: true,
    });

    for (const item of queue.enqueued) {
      expect(item).not.toHaveProperty("portfolio");
      expect(item).not.toHaveProperty("strategy");
      expect(item).not.toHaveProperty("anchor");
      expect("priority" in item && item.priority !== undefined).toBe(false);
      expect(item.objective.toLowerCase()).not.toContain("priorizar");
      expect(item.objective.toLowerCase()).not.toContain("portfolio");
      expect(item.objective.toLowerCase()).not.toContain("estratégia");
      expect(item.objective.toLowerCase()).not.toContain("estrategia");
    }
  });

  it("ciclo sem sinais operacionais nao cria missao", async () => {
    const queue = createQueue({ rows: [] });
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const { queue: queueReport } = await new QueueMonitor(
      queue,
      { list: () => [], aliveCount: () => 0 },
      clock,
      30_000,
    ).scan();

    const result = await new CoordinationDispatcher(queue, noopLogger()).dispatch(
      {
        workspaces: emptyWorkspaceReport(),
        missions,
        queue: { ...queueReport, congested: false },
        recovery: emptyRecovery(),
        healthOk: true,
      },
    );

    expect(result.dispatched).toBe(0);
    expect(result.coordinations).toHaveLength(0);
    expect(queue.enqueued).toHaveLength(0);
  });

  it("falha de health operacional nao dispara coordenacao", async () => {
    const events: string[] = [];
    const logger: SupervisorLoggerPort = {
      emit(event) {
        events.push(event);
      },
    };
    const queue = createQueue({ rows: [] });
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const { queue: queueReport } = await new QueueMonitor(
      queue,
      { list: () => [], aliveCount: () => 0 },
      clock,
      30_000,
    ).scan();

    const result = await new CoordinationDispatcher(queue, logger).dispatch({
      workspaces: await attentionWorkspaces(queue),
      missions,
      queue: queueReport,
      recovery: emptyRecovery(),
      healthOk: false,
    });

    expect(result.dispatched).toBe(0);
    expect(result.details).toContain("health fail — sem coordination");
    expect(result.coordinations).toHaveLength(0);
    expect(queue.enqueued).toHaveLength(0);
    expect(events).not.toContain(SupervisorEvent.COORDINATION_CREATED);
  });

  it("loop com health fail nao enfileira COORDINATE apesar de backlog", async () => {
    const queue = createQueue({ rows: [] });
    const workspaces = new InMemoryWorkspaceSource(buildTestWorkspaceCatalog());
    const logger = noopLogger();

    const loop = new SupervisorLoop({
      healthMonitor: new HealthMonitor(
        [
          {
            name: "registry",
            check: async () => ({ status: "fail", detail: "registry vazio" }),
          },
        ],
        clock,
      ),
      workspaceScanner: new WorkspaceScanner(workspaces, queue, clock),
      missionScanner: new MissionScanner(queue, clock, 30_000),
      queueMonitor: new QueueMonitor(
        queue,
        { list: () => [], aliveCount: () => 0 },
        clock,
        30_000,
      ),
      recoveryCoordinator: new RecoveryCoordinator(
        queue,
        logger,
        clock,
        30_000,
      ),
      coordinationDispatcher: new CoordinationDispatcher(queue, logger),
      snapshots: new SnapshotGenerator(clock),
      snapshotStore: new InMemorySnapshotStore(),
      logger,
      intervalMs: 60_000,
      staleRunningMs: 30_000,
    });

    const ctx = await loop.runCycle();
    expect(ctx).not.toBeNull();
    expect(ctx!.health.overall).toBe("fail");
    expect(ctx!.dispatch.dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(0);
  });
});
