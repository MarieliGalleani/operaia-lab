/**
 * F6.1 — retry automatico de FAILED + politica FAILED esgotado (unitario).
 */
import { describe, expect, it } from "vitest";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import { MissionScanner } from "./mission-scanner.js";
import type { MissionQueuePort, MissionView, SupervisorLoggerPort } from "./ports.js";
import { RecoveryCoordinator } from "./recovery-coordinator.js";
import { AutoRetryPolicy } from "./policy-engine.js";
import { SupervisorEvent } from "./types.js";
import type {
  MissionScanReport,
  QueueScanReport,
  WorkspaceScanReport,
} from "./types.js";
import { InMemoryCoordinationLatchStore } from "./infrastructure/in-memory-coordination-latch-store.js";
import { hashObjective } from "../mission-queue.js";

const fixedNow = new Date("2026-08-19T12:00:00.000Z");
const clock = { now: () => fixedNow };

function mission(
  partial: Partial<MissionView> & { id: string },
): MissionView & { status: string; objective?: string } {
  return {
    workspaceId: "nexo",
    status: "FAILED",
    readiness: "READY",
    attempt: 1,
    maxAttempts: 3,
    updatedAt: fixedNow,
    startedAt: null,
    lastError: "erro",
    missionKind: "EXECUTE",
    ownerEmployeeId: "cto-mag",
    ...partial,
  };
}

function createStatefulQueue(initial: Array<MissionView & { status: string }>): MissionQueuePort & {
  rows: Array<MissionView & { status: string; objective?: string }>;
  enqueued: Array<{ objective: string; id: string }>;
} {
  const rows = initial.map((row) => ({ ...row }));
  const enqueued: Array<{ objective: string; id: string }> = [];
  let seq = 0;
  return {
    rows,
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
      return 0;
    },
    async recoverWaitingParents() {
      return 0;
    },
    async recoverBlockedDag() {
      return 0;
    },
    async recoverFailedRetryable() {
      let n = 0;
      for (const row of rows) {
        if (row.status !== "FAILED" || row.attempt >= row.maxAttempts) {
          continue;
        }
        row.status = "QUEUED";
        n += 1;
      }
      return n;
    },
    async findByObjectiveHash(workspaceId, objectiveHash) {
      const open = rows.find(
        (r) =>
          r.workspaceId === workspaceId &&
          r.objective !== undefined &&
          hashObjective(workspaceId, r.objective) === objectiveHash &&
          (r.status === "QUEUED" ||
            r.status === "RUNNING" ||
            r.status === "CREATED" ||
            r.status === "WAITING"),
      );
      return open ? { id: open.id, status: open.status } : null;
    },
    async enqueue(input) {
      const existing = rows.find(
        (r) =>
          r.workspaceId === input.workspaceId &&
          r.objective === input.objective &&
          (r.status === "QUEUED" ||
            r.status === "RUNNING" ||
            r.status === "CREATED" ||
            r.status === "WAITING"),
      );
      if (input.dedupe && existing) {
        return { created: false, id: existing.id };
      }
      seq += 1;
      const id = `coord-${seq}`;
      enqueued.push({ objective: input.objective, id });
      rows.push({
        id,
        workspaceId: input.workspaceId,
        status: "QUEUED",
        readiness: "READY",
        attempt: 0,
        maxAttempts: 3,
        updatedAt: fixedNow,
        startedAt: null,
        lastError: null,
        missionKind: "COORDINATE",
        ownerEmployeeId: input.ownerEmployeeId,
        objective: input.objective,
      });
      return { created: true, id };
    },
  };
}

const emptyWorkspaces: WorkspaceScanReport = {
  scannedAt: fixedNow.toISOString(),
  workspaces: [],
  activeCount: 0,
  readyCount: 0,
  attentionCount: 0,
};

const emptyQueueReport: QueueScanReport = {
  scannedAt: fixedNow.toISOString(),
  depth: 0,
  congested: false,
  stuck: 0,
  waiting: 0,
  pending: 0,
  retry: 0,
  running: 0,
  failed: 0,
  workersAvailable: 9,
  workersBusy: 0,
  depths: { queued: 0, running: 0, waiting: 0, failed: 0 },
};

const emptyRecovery = {
  recoveredAt: fixedNow.toISOString(),
  actions: [],
  infraRecovered: 0,
  coordinationsRequested: 0,
};

describe("F6.1 — FAILED retry automatico", () => {
  it("A — FAILED retryable → QUEUED, mesmo id, sem COORDINATE", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-retry", attempt: 1, maxAttempts: 3 }),
    ]);
    const scanner = new MissionScanner(queue, clock, 30_000);
    const report = await scanner.scan();
    const retryItem = report.items.find((i) => i.missionId === "m-retry");
    expect(retryItem?.category).toBe("RETRY");
    expect(retryItem?.needsCoordination).toBe(false);

    const recovery = await new RecoveryCoordinator(
      queue,
      { emit: () => {} },
      clock,
      30_000,
    ).recover({
      missions: report,
      queue: emptyQueueReport,
      workspaces: emptyWorkspaces,
    });

    expect(recovery.actions.some((a) => a.kind === "failed_retry")).toBe(true);
    expect(queue.rows[0]?.status).toBe("QUEUED");
    expect(queue.rows[0]?.id).toBe("m-retry");
    expect(queue.enqueued).toHaveLength(0);
  });

  it("B — FAILED exhausted permanece FAILED e nao e reenfileirado", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-dead", attempt: 3, maxAttempts: 3 }),
    ]);
    const report = await new MissionScanner(queue, clock, 30_000).scan();
    const item = report.items.find((i) => i.missionId === "m-dead");
    expect(item?.category).toBe("FAILED");
    expect(item?.needsCoordination).toBe(true);
    expect(item?.canResume).toBe(false);

    const recovery = await new RecoveryCoordinator(
      queue,
      { emit: () => {} },
      clock,
      30_000,
    ).recover({
      missions: report,
      queue: emptyQueueReport,
      workspaces: emptyWorkspaces,
    });

    expect(recovery.actions.some((a) => a.kind === "failed_retry")).toBe(false);
    expect(recovery.actions.some((a) => a.kind === "failed_exhausted")).toBe(
      true,
    );
    expect(queue.rows.find((r) => r.id === "m-dead")?.status).toBe("FAILED");
    expect(queue.enqueued).toHaveLength(0);
  });

  it("C — FAILED exhausted produz exatamente uma escalacao operacional", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-dead", attempt: 3, maxAttempts: 3 }),
    ]);
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const events: Array<{ event: SupervisorEvent; data: Record<string, unknown> }> =
      [];
    const logger: SupervisorLoggerPort = {
      emit(event, data = {}) {
        events.push({ event, data: { ...data } });
      },
    };
    const latches = new InMemoryCoordinationLatchStore();
    const dispatcher = new CoordinationDispatcher(queue, logger, latches);

    const result = await dispatcher.dispatch({
      workspaces: emptyWorkspaces,
      missions,
      queue: emptyQueueReport,
      recovery: emptyRecovery,
      healthOk: true,
    });

    expect(result.dispatched).toBe(1);
    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0]?.objective).toContain("missao_esgotada:m-dead");
    expect(queue.enqueued[0]?.objective).toContain("m-dead");
    expect(queue.rows.find((r) => r.id === "m-dead")?.status).toBe("FAILED");
    expect(
      events.some((e) => e.event === SupervisorEvent.COORDINATION_CREATED),
    ).toBe(true);
    const created = events.find(
      (e) => e.event === SupervisorEvent.COORDINATION_CREATED,
    );
    expect(created?.data.sourceMissionId).toBe("m-dead");
    expect(created?.data.attempt).toBe(3);
    expect(created?.data.maxAttempts).toBe(3);
  });

  it("D — segundo ciclo nao cria segunda escalacao", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-dead", attempt: 3, maxAttempts: 3 }),
    ]);
    const logger: SupervisorLoggerPort = { emit: () => {} };
    const latches = new InMemoryCoordinationLatchStore();
    const dispatcher = new CoordinationDispatcher(queue, logger, latches);

    const first = await dispatcher.dispatch({
      workspaces: emptyWorkspaces,
      missions: await new MissionScanner(queue, clock, 30_000).scan(),
      queue: emptyQueueReport,
      recovery: emptyRecovery,
      healthOk: true,
    });
    const second = await dispatcher.dispatch({
      workspaces: emptyWorkspaces,
      missions: await new MissionScanner(queue, clock, 30_000).scan(),
      queue: emptyQueueReport,
      recovery: emptyRecovery,
      healthOk: true,
    });

    expect(first.dispatched).toBe(1);
    expect(second.dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(1);
  });

  it("E — deduplicacao persiste apos reiniciar dispatcher/latch (fila OPEN)", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-dead", attempt: 3, maxAttempts: 3 }),
    ]);
    const logger: SupervisorLoggerPort = { emit: () => {} };

    const first = await new CoordinationDispatcher(
      queue,
      logger,
      new InMemoryCoordinationLatchStore(),
    ).dispatch({
      workspaces: emptyWorkspaces,
      missions: await new MissionScanner(queue, clock, 30_000).scan(),
      queue: emptyQueueReport,
      recovery: emptyRecovery,
      healthOk: true,
    });

    // Simula restart: novo latch store (memoria limpa), fila Postgres ainda OPEN.
    const second = await new CoordinationDispatcher(
      queue,
      logger,
      new InMemoryCoordinationLatchStore(),
    ).dispatch({
      workspaces: emptyWorkspaces,
      missions: await new MissionScanner(queue, clock, 30_000).scan(),
      queue: emptyQueueReport,
      recovery: emptyRecovery,
      healthOk: true,
    });

    expect(first.dispatched).toBe(1);
    expect(second.dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(1);
    expect(
      queue.rows.filter((r) => r.missionKind === "COORDINATE"),
    ).toHaveLength(1);
  });

  it("F — duas FAILED exhausted distintas geram escalacoes independentes", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-a", attempt: 3, maxAttempts: 3 }),
      mission({ id: "m-b", attempt: 5, maxAttempts: 5, workspaceId: "nexo" }),
    ]);
    const logger: SupervisorLoggerPort = { emit: () => {} };
    const result = await new CoordinationDispatcher(
      queue,
      logger,
      new InMemoryCoordinationLatchStore(),
    ).dispatch({
      workspaces: emptyWorkspaces,
      missions: await new MissionScanner(queue, clock, 30_000).scan(),
      queue: emptyQueueReport,
      recovery: emptyRecovery,
      healthOk: true,
    });

    expect(result.dispatched).toBe(2);
    expect(queue.enqueued).toHaveLength(2);
    expect(queue.enqueued.some((e) => e.objective.includes("m-a"))).toBe(true);
    expect(queue.enqueued.some((e) => e.objective.includes("m-b"))).toBe(true);
  });

  it("segundo ciclo de recovery retryable nao duplica missao", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-once", attempt: 1, maxAttempts: 3 }),
    ]);
    const scanner = new MissionScanner(queue, clock, 30_000);
    const coordinator = new RecoveryCoordinator(
      queue,
      { emit: () => {} },
      clock,
      30_000,
    );

    const first = await coordinator.recover({
      missions: await scanner.scan(),
      queue: emptyQueueReport,
      workspaces: emptyWorkspaces,
    });
    const second = await coordinator.recover({
      missions: await scanner.scan(),
      queue: emptyQueueReport,
      workspaces: emptyWorkspaces,
    });

    expect(first.actions.find((a) => a.kind === "failed_retry")?.count).toBe(1);
    expect(second.actions.some((a) => a.kind === "failed_retry")).toBe(false);
    expect(queue.rows.filter((r) => r.id === "m-once")).toHaveLength(1);
  });

  it("Supervisor dispatch nao cria COORDINATE para RETRY", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-retry", attempt: 1, maxAttempts: 3 }),
    ]);
    const missions = await new MissionScanner(queue, clock, 30_000).scan();
    const events: SupervisorEvent[] = [];
    const logger: SupervisorLoggerPort = {
      emit(event) {
        events.push(event);
      },
    };
    const dispatcher = new CoordinationDispatcher(
      queue,
      logger,
      new InMemoryCoordinationLatchStore(),
    );
    const result = await dispatcher.dispatch({
      workspaces: emptyWorkspaces,
      missions,
      queue: emptyQueueReport,
      recovery: emptyRecovery,
      healthOk: true,
    });

    expect(result.dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(0);
    expect(events).not.toContain(SupervisorEvent.COORDINATION_CREATED);
  });

  it("AutoRetryPolicy sinaliza fila quando ha RETRY", () => {
    const missions: MissionScanReport = {
      scannedAt: fixedNow.toISOString(),
      items: [
        {
          missionId: "x",
          workspaceId: "nexo",
          status: "FAILED",
          category: "RETRY",
          attempt: 1,
          maxAttempts: 3,
          canResume: true,
          needsCoordination: false,
          reason: "retry",
        },
      ],
      resumableCount: 1,
      coordinationNeeded: 0,
      byStatus: { FAILED: 1 },
    };
    const actions = new AutoRetryPolicy().evaluate({
      health: { checkedAt: "", overall: "ok", components: [] },
      workspaces: emptyWorkspaces,
      missions,
      queue: emptyQueueReport,
      workers: { alive: 9, total: 9, stopped: 0, busy: 0, available: 9 },
      staleRunningMs: 15_000,
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("recover_queue");
  });
});
