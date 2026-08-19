/**
 * F6.1 — retry automatico de FAILED (unitario, sem Prisma).
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

const fixedNow = new Date("2026-08-19T12:00:00.000Z");
const clock = { now: () => fixedNow };

function mission(
  partial: Partial<MissionView> & { id: string },
): MissionView & { status: string } {
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
  rows: Array<MissionView & { status: string }>;
  enqueued: Array<{ objective: string }>;
} {
  const rows = initial.map((row) => ({ ...row }));
  const enqueued: Array<{ objective: string }> = [];
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
    async enqueue(input) {
      enqueued.push({ objective: input.objective });
      return { created: true, id: "new-coord" };
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

describe("F6.1 — FAILED retry automatico", () => {
  it("TESTE A — FAILED retryable → QUEUED, mesmo id, sem COORDINATE", async () => {
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

  it("TESTE B — FAILED exhausted permanece FAILED", async () => {
    const queue = createStatefulQueue([
      mission({ id: "m-dead", attempt: 3, maxAttempts: 3 }),
    ]);
    const report = await new MissionScanner(queue, clock, 30_000).scan();
    expect(report.items.find((i) => i.missionId === "m-dead")?.category).toBe(
      "FAILED",
    );

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
    expect(queue.rows[0]?.status).toBe("FAILED");
  });

  it("TESTE C — segundo ciclo de recovery nao duplica missao", async () => {
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

  it("TESTE D — Supervisor dispatch nao cria COORDINATE para RETRY", async () => {
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
      recovery: {
        recoveredAt: fixedNow.toISOString(),
        actions: [],
        infraRecovered: 0,
        coordinationsRequested: 0,
      },
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
