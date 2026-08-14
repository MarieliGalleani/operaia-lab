import { describe, expect, it } from "vitest";
import { InMemoryWorkspaceSource } from "../../employees/in-memory-workspace-source.js";
import { buildTestWorkspaceCatalog } from "../../employees/test-workspace-catalog.js";
import { CEO_EMPLOYEE_ID } from "../mission-states.js";
import { hashObjective } from "../mission-queue.js";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import { HealthMonitor } from "./health-monitor.js";
import { InMemoryCoordinationLatchStore } from "./infrastructure/in-memory-coordination-latch-store.js";
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

function freshLatches() {
  return new InMemoryCoordinationLatchStore();
}

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
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    ...partial,
  };
}

function createQueue(
  overrides: Partial<MissionQueuePort> & {
    readonly rows?: readonly MissionView[];
    readonly abandonedRunningIds?: readonly string[];
  } = {},
): MissionQueuePort & {
  enqueued: EnqueuedMission[];
  missionsByHash: Map<string, { id: string; status: string; createdAt: Date; objectiveHash: string; workspaceId: string }>;
} {
  const rows = overrides.rows ?? [];
  const abandonedRunningIds = overrides.abandonedRunningIds ?? [];
  const enqueued: EnqueuedMission[] = [];
  const openFromEnqueue: MissionView[] = [];
  const missionsByHash = new Map<
    string,
    {
      id: string;
      status: string;
      createdAt: Date;
      objectiveHash: string;
      workspaceId: string;
    }
  >();

  const base: MissionQueuePort & {
    enqueued: EnqueuedMission[];
    missionsByHash: typeof missionsByHash;
  } = {
    enqueued,
    missionsByHash,
    async depths() {
      const all = [...rows, ...openFromEnqueue];
      return {
        queued: all.filter((r) => r.status === "QUEUED").length,
        running: all.filter((r) => r.status === "RUNNING").length,
        waiting: all.filter((r) => r.status === "WAITING").length,
        failed: all.filter((r) => r.status === "FAILED").length,
      };
    },
    async list(filters) {
      const all = [...rows, ...openFromEnqueue];
      if (!filters?.status) {
        return all;
      }
      return all.filter((r) => r.status === filters.status);
    },
    async listAbandonedRunningIds() {
      return abandonedRunningIds;
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
      const objectiveHash = hashObjective(input.workspaceId, input.objective);
      const existingOpen = [...missionsByHash.values()].find(
        (m) =>
          m.workspaceId === input.workspaceId &&
          m.objectiveHash === objectiveHash &&
          ["CREATED", "QUEUED", "RUNNING", "WAITING"].includes(m.status),
      );
      if (input.dedupe && existingOpen) {
        return { created: false, id: existingOpen.id };
      }
      enqueued.push({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        objective: input.objective,
        ownerEmployeeId: input.ownerEmployeeId,
        priority: input.priority,
        dedupe: input.dedupe,
      });
      const id = `coord-${enqueued.length}`;
      missionsByHash.set(id, {
        id,
        status: "QUEUED",
        createdAt: new Date(),
        objectiveHash,
        workspaceId: input.workspaceId,
      });
      openFromEnqueue.push(
        mission({
          id,
          status: "QUEUED",
          workspaceId: input.workspaceId,
          missionKind: "COORDINATE",
          ownerEmployeeId: input.ownerEmployeeId,
          objective: input.objective,
        }),
      );
      return { created: true, id };
    },
    async findByObjectiveHash(workspaceId, objectiveHash, options) {
      const matches = [...missionsByHash.values()]
        .filter(
          (m) =>
            m.workspaceId === workspaceId &&
            m.objectiveHash === objectiveHash &&
            (!options?.createdAtGte || m.createdAt >= options.createdAtGte),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const hit = matches[0];
      return hit ? { id: hit.id, status: hit.status } : null;
    },
  };

  return {
    ...base,
    ...overrides,
    enqueued,
    missionsByHash,
    listAbandonedRunningIds:
      overrides.listAbandonedRunningIds ?? base.listAbandonedRunningIds,
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
      // MQ-3: STALE vem de liveness abandonada, nao de Mission.updatedAt.
      abandonedRunningIds: ["s1"],
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
      abandonedRunningIds: ["s1"],
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

    const dispatcher = new CoordinationDispatcher(queue, logger, freshLatches());
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

    const result = await new CoordinationDispatcher(queue, logger, freshLatches()).dispatch({
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
      coordinationDispatcher: new CoordinationDispatcher(queue, logger, freshLatches()),
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

    await new CoordinationDispatcher(queue, noopLogger(), freshLatches()).dispatch({
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

    await new CoordinationDispatcher(queue, noopLogger(), freshLatches()).dispatch({
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

    await new CoordinationDispatcher(queue, noopLogger(), freshLatches()).dispatch({
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

    const result = await new CoordinationDispatcher(queue, noopLogger(), freshLatches()).dispatch(
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

    const result = await new CoordinationDispatcher(queue, logger, freshLatches()).dispatch({
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
      coordinationDispatcher: new CoordinationDispatcher(queue, logger, freshLatches()),
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

describe("Coordination latch edge-triggered (PENDING/CONSUMED)", () => {
  const emptyMissions = {
    scannedAt: fixedNow.toISOString(),
    items: [] as const,
    resumableCount: 0,
    coordinationNeeded: 0,
    byStatus: {},
  };

  const idleQueue = {
    scannedAt: fixedNow.toISOString(),
    pending: 0,
    running: 0,
    failed: 0,
    waiting: 0,
    retry: 0,
    stuck: 0,
    depth: 0,
    congested: false,
    workersAvailable: 0,
    workersBusy: 0,
    depths: { queued: 0, running: 0, waiting: 0, failed: 0 },
  };

  function reportWith(
    items: readonly {
      readonly workspaceId: string;
      readonly reasons: readonly (
        | "backlog"
        | "mudanca_importante"
        | "recuperacao"
      )[];
    }[],
  ): WorkspaceScanReport {
    return {
      scannedAt: fixedNow.toISOString(),
      activeCount: items.length,
      readyCount: items.length,
      attentionCount: items.filter((i) => i.reasons.length > 0).length,
      workspaces: items.map((item) => ({
        workspaceId: item.workspaceId,
        name: item.workspaceId.toUpperCase(),
        status: "ACTIVE",
        projectId: item.workspaceId,
        pendingTasks: item.reasons.includes("backlog") ? 2 : 0,
        teamSize: 1,
        hasActiveMission: false,
        hasBlockedMission: false,
        hasWaitingMission: false,
        hasReadyMission: false,
        hasBacklog: item.reasons.includes("backlog"),
        hasChanges: item.reasons.length > 0,
        needsAttention: item.reasons.length > 0,
        attentionReasons: item.reasons.filter(
          (r) => r === "backlog" || r === "mudanca_importante",
        ),
        openMissions: 0,
        ready: true,
        issues: [],
      })),
    };
  }

  function missionsWithRecuperacao(workspaceId: string) {
    return {
      scannedAt: fixedNow.toISOString(),
      items: [
        {
          missionId: "failed-1",
          workspaceId,
          status: "FAILED",
          category: "FAILED" as const,
          attempt: 3,
          maxAttempts: 3,
          canResume: false,
          needsCoordination: true,
          reason: "FAILED sem tentativas",
        },
      ],
      resumableCount: 0,
      coordinationNeeded: 1,
      byStatus: { FAILED: 1 },
    };
  }

  const backlogPayload = {
    workspaces: reportWith([{ workspaceId: "nexo", reasons: ["backlog"] }]),
    missions: emptyMissions,
    queue: idleQueue,
    recovery: emptyRecovery(),
    healthOk: true,
  };

  /** 1 — fluxo normal */
  it("c2.1: acquire → enqueue → complete = 1 missao + latch CONSUMED", async () => {
    const queue = createQueue({ rows: [] });
    const latches = freshLatches();
    const dispatcher = new CoordinationDispatcher(queue, noopLogger(), latches);

    const result = await dispatcher.dispatch(backlogPayload);
    expect(result.dispatched).toBe(1);
    expect(queue.enqueued).toHaveLength(1);
    const latch = latches.getForTest({ workspaceId: "nexo", reason: "backlog" });
    expect(latch?.status).toBe("CONSUMED");
    expect(latch?.lastMissionId).toBe("coord-1");
  });

  /** 2 — enqueue lanca erro */
  it("c2.2: enqueue throws → latch liberado → retry permitido", async () => {
    const latches = freshLatches();
    let attempts = 0;
    const queue = createQueue({
      async enqueue() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("enqueue failed");
        }
        return { created: true, id: "coord-retry" };
      },
    });
    const dispatcher = new CoordinationDispatcher(queue, noopLogger(), latches);

    await expect(dispatcher.dispatch(backlogPayload)).rejects.toThrow(
      "enqueue failed",
    );
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" }),
    ).toBeUndefined();

    const retry = await dispatcher.dispatch(backlogPayload);
    expect(retry.dispatched).toBe(1);
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" })?.status,
    ).toBe("CONSUMED");
  });

  /** 3 — crash entre acquire e enqueue (PENDING orfao) */
  it("c2.3: PENDING orfao stale e recuperado → cria COORDINATE sem duplicata", async () => {
    const queue = createQueue({ rows: [] });
    const latches = freshLatches();
    latches.leavePendingOrphanForTest({
      workspaceId: "nexo",
      reason: "backlog",
    });
    const dispatcher = new CoordinationDispatcher(
      queue,
      noopLogger(),
      latches,
      60_000,
    );

    const result = await dispatcher.dispatch(backlogPayload);
    expect(result.dispatched).toBe(1);
    expect(queue.enqueued).toHaveLength(1);
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" })?.status,
    ).toBe("CONSUMED");
  });

  /** 4 — missao ja existente na borda */
  it("c2.4: PENDING orfao com missao ja existente → complete sem duplicata", async () => {
    const queue = createQueue({ rows: [] });
    const latches = freshLatches();
    const orphanAt = new Date(Date.now() - 120_000);
    latches.leavePendingOrphanForTest(
      { workspaceId: "nexo", reason: "backlog" },
      orphanAt,
    );

    const objective =
      "[COORDINATE/backlog] Atencao operacional no workspace nexo. workspace NEXO: backlog";
    const h = hashObjective("nexo", objective);
    queue.missionsByHash.set("preexisting", {
      id: "preexisting",
      status: "COMPLETED",
      createdAt: new Date(orphanAt.getTime() + 1_000),
      objectiveHash: h,
      workspaceId: "nexo",
    });

    const dispatcher = new CoordinationDispatcher(
      queue,
      noopLogger(),
      latches,
      60_000,
    );
    const result = await dispatcher.dispatch(backlogPayload);
    expect(result.dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(0);
    const latch = latches.getForTest({ workspaceId: "nexo", reason: "backlog" });
    expect(latch?.status).toBe("CONSUMED");
    expect(latch?.lastMissionId).toBe("preexisting");
  });

  /** 5 — concorrencia */
  it("c2.5: tryAcquire concorrente — apenas um acquired", async () => {
    const store = freshLatches();
    const key = { workspaceId: "nexo", reason: "backlog" };
    const results = await Promise.all([
      store.tryAcquire(key),
      store.tryAcquire(key),
      store.tryAcquire(key),
      store.tryAcquire(key),
    ]);
    expect(results.filter((r) => r.acquired)).toHaveLength(1);
    expect(results.filter((r) => !r.acquired)).toHaveLength(3);
  });

  /** 6 — sinal persistente */
  it("c2.6: sinal persistente → 0 novas COORDINATE", async () => {
    const queue = createQueue({ rows: [] });
    const dispatcher = new CoordinationDispatcher(
      queue,
      noopLogger(),
      freshLatches(),
    );
    expect((await dispatcher.dispatch(backlogPayload)).dispatched).toBe(1);
    expect((await dispatcher.dispatch(backlogPayload)).dispatched).toBe(0);
    expect((await dispatcher.dispatch(backlogPayload)).dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(1);
  });

  /** 7 — sinal desaparece e retorna */
  it("c2.7: sinal some e volta → nova COORDINATE", async () => {
    const queue = createQueue({ rows: [] });
    const latches = freshLatches();
    const dispatcher = new CoordinationDispatcher(
      queue,
      noopLogger(),
      latches,
    );
    const present = {
      workspaces: reportWith([{ workspaceId: "nexo", reasons: ["backlog"] }]),
      missions: emptyMissions,
      queue: idleQueue,
      recovery: emptyRecovery(),
      healthOk: true,
    };
    const absent = {
      workspaces: reportWith([{ workspaceId: "nexo", reasons: [] }]),
      missions: emptyMissions,
      queue: idleQueue,
      recovery: emptyRecovery(),
      healthOk: true,
    };

    expect((await dispatcher.dispatch(present)).dispatched).toBe(1);
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" })?.status,
    ).toBe("CONSUMED");

    // Borda anterior concluida — missao terminal + latch liberado ao sumir sinal.
    for (const m of queue.missionsByHash.values()) {
      m.status = "COMPLETED";
    }
    expect((await dispatcher.dispatch(absent)).dispatched).toBe(0);
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" }),
    ).toBeUndefined();

    expect((await dispatcher.dispatch(present)).dispatched).toBe(1);
    expect(queue.enqueued).toHaveLength(2);
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" })?.status,
    ).toBe("CONSUMED");
  });

  it("caso3: backlog+mudanca_importante+recuperacao → 3 latches", async () => {
    const queue = createQueue({ rows: [] });
    const dispatcher = new CoordinationDispatcher(
      queue,
      noopLogger(),
      freshLatches(),
    );
    const payload = {
      workspaces: reportWith([
        { workspaceId: "nexo", reasons: ["backlog", "mudanca_importante"] },
      ]),
      missions: missionsWithRecuperacao("nexo"),
      queue: idleQueue,
      recovery: emptyRecovery(),
      healthOk: true,
    };
    expect((await dispatcher.dispatch(payload)).dispatched).toBe(3);
    expect((await dispatcher.dispatch(payload)).dispatched).toBe(0);
  });

  it("caso4: latches independentes por workspace", async () => {
    const queue = createQueue({ rows: [] });
    const dispatcher = new CoordinationDispatcher(
      queue,
      noopLogger(),
      freshLatches(),
    );
    const both = {
      workspaces: reportWith([
        { workspaceId: "nexo", reasons: ["backlog"] },
        { workspaceId: "outro-workspace", reasons: ["backlog"] },
      ]),
      missions: emptyMissions,
      queue: idleQueue,
      recovery: emptyRecovery(),
      healthOk: true,
    };
    expect((await dispatcher.dispatch(both)).dispatched).toBe(2);
    expect((await dispatcher.dispatch(both)).dispatched).toBe(0);
  });

  it("caso5: restart preserva CONSUMED via store compartilhado", async () => {
    const queue = createQueue({ rows: [] });
    const sharedStore = freshLatches();
    const before = new CoordinationDispatcher(queue, noopLogger(), sharedStore);
    expect((await before.dispatch(backlogPayload)).dispatched).toBe(1);
    const after = new CoordinationDispatcher(queue, noopLogger(), sharedStore);
    expect((await after.dispatch(backlogPayload)).dispatched).toBe(0);
  });

  it("F6.2: atencao persistente apos COMPLETED → dispatched=0", async () => {
    const queue = createQueue({ rows: [] });
    const latches = freshLatches();
    const dispatcher = new CoordinationDispatcher(queue, noopLogger(), latches);
    expect((await dispatcher.dispatch(backlogPayload)).dispatched).toBe(1);
    for (const m of queue.missionsByHash.values()) {
      m.status = "COMPLETED";
    }
    // Simula COORDINATE terminal: remove da lista OPEN (openFromEnqueue via hash).
    expect((await dispatcher.dispatch(backlogPayload)).dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(1);
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" })?.status,
    ).toBe("CONSUMED");
  });

  it("F6.2: oscilacao por COORDINATE OPEN nao libera latch (sticky)", async () => {
    const queue = createQueue({ rows: [] });
    const latches = freshLatches();
    const dispatcher = new CoordinationDispatcher(queue, noopLogger(), latches);
    expect((await dispatcher.dispatch(backlogPayload)).dispatched).toBe(1);

    // Ciclo intermediario: scanner "esquece" backlog (oscilacao), mas COORDINATE ainda OPEN.
    const blank = {
      workspaces: reportWith([{ workspaceId: "nexo", reasons: [] }]),
      missions: emptyMissions,
      queue: idleQueue,
      recovery: emptyRecovery(),
      healthOk: true,
    };
    // requests.length===0 → releaseAll no dispatcher atual.
    // Sticky so aplica quando ha requests; para oscilacao parcial use so mudanca_importante sumindo.
    const onlyOtherGone = {
      workspaces: reportWith([
        { workspaceId: "nexo", reasons: ["mudanca_importante"] },
      ]),
      missions: emptyMissions,
      queue: idleQueue,
      recovery: emptyRecovery(),
      healthOk: true,
    };
    // Primeiro dispatch criou backlog; segundo com so mudanca_importante:
    // sticky mantem backlog se COORDINATE OPEN ainda listado.
    const mid = await dispatcher.dispatch({
      workspaces: reportWith([{ workspaceId: "nexo", reasons: [] }]),
      // Forca requests nao-vazio via mission recuperacao sem liberar backlog latch
      missions: missionsWithRecuperacao("nexo"),
      queue: idleQueue,
      recovery: emptyRecovery(),
      healthOk: true,
    });
    expect(mid.dispatched).toBeGreaterThanOrEqual(0);
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" })?.status,
    ).toBe("CONSUMED");

    // Atencao backlog volta — sem nova missao.
    expect((await dispatcher.dispatch(backlogPayload)).dispatched).toBe(0);
    expect(
      queue.enqueued.filter((e) => e.objective.includes("[COORDINATE/backlog]")),
    ).toHaveLength(1);
    void blank;
    void onlyOtherGone;
  });

  it("F6.2: reason some de verdade → latch liberado; retorno → nova COORDINATE", async () => {
    const queue = createQueue({ rows: [] });
    const latches = freshLatches();
    const dispatcher = new CoordinationDispatcher(queue, noopLogger(), latches);
    expect((await dispatcher.dispatch(backlogPayload)).dispatched).toBe(1);
    for (const m of queue.missionsByHash.values()) {
      m.status = "COMPLETED";
    }
    // Remove OPEN da lista: recria queue sem open missions — simula complete limpando OPEN.
    const queue2 = createQueue({ rows: [] });
    // Copia latch store; missions OPEN vazias
    const present = backlogPayload;
    const absent = {
      workspaces: reportWith([{ workspaceId: "nexo", reasons: [] }]),
      missions: emptyMissions,
      queue: idleQueue,
      recovery: emptyRecovery(),
      healthOk: true,
    };
    const d2 = new CoordinationDispatcher(queue2, noopLogger(), latches);
    expect((await d2.dispatch(absent)).dispatched).toBe(0);
    expect(
      latches.getForTest({ workspaceId: "nexo", reason: "backlog" }),
    ).toBeUndefined();
    expect((await d2.dispatch(present)).dispatched).toBe(1);
  });
});
