/**
 * P0.2H-POST.1A — dispatcher: CONSUMED nao re-despacha; release nao apaga exhausted.
 */
import { describe, expect, it } from "vitest";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import { exhaustedMissionLatchReason } from "./coordination-latch-store.js";
import { InMemoryCoordinationLatchStore } from "./infrastructure/in-memory-coordination-latch-store.js";
import type { MissionQueuePort, MissionView } from "./ports.js";
import type {
  MissionScanReport,
  QueueScanReport,
  WorkspaceScanReport,
} from "./types.js";

const fixedNow = new Date("2026-08-24T12:00:00.000Z");

function mission(
  partial: Partial<MissionView> & { id: string },
): MissionView & { status: string; objective?: string } {
  return {
    workspaceId: "nexo",
    status: "FAILED",
    readiness: "READY",
    attempt: 3,
    maxAttempts: 3,
    updatedAt: fixedNow,
    startedAt: null,
    lastError: "erro",
    missionKind: "EXECUTE",
    ownerEmployeeId: "cto-mag",
    ...partial,
  };
}

function createQueue(initial: MissionView[] = []): MissionQueuePort & {
  enqueued: Array<{ objective: string }>;
} {
  const rows = initial.map((row) => ({ ...row }));
  const enqueued: Array<{ objective: string }> = [];
  return {
    enqueued,
    async depths() {
      return { queued: 0, running: 0, waiting: 0, failed: 0 };
    },
    async list() {
      return rows;
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
      return 0;
    },
    async enqueue(input) {
      enqueued.push({ objective: input.objective });
      return { created: true, id: `coord-${enqueued.length}` };
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

const emptyQueue: QueueScanReport = {
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

function failedScan(item: {
  missionId: string;
  needsCoordination: boolean;
}): MissionScanReport {
  return {
    scannedAt: fixedNow.toISOString(),
    items: [
      {
        missionId: item.missionId,
        workspaceId: "nexo",
        status: "FAILED",
        category: "FAILED",
        attempt: 3,
        maxAttempts: 3,
        canResume: false,
        needsCoordination: item.needsCoordination,
        reason: "FAILED esgotado",
      },
    ],
    resumableCount: 0,
    coordinationNeeded: item.needsCoordination ? 1 : 0,
    byStatus: { FAILED: 1 },
  };
}

const emptyMissions: MissionScanReport = {
  scannedAt: fixedNow.toISOString(),
  items: [],
  resumableCount: 0,
  coordinationNeeded: 0,
  byStatus: {},
};

describe("CoordinationDispatcher — exhausted CONSUMED", () => {
  it("C — latch CONSUMED nao gera novo dispatch", async () => {
    const queue = createQueue([mission({ id: "m-acked" })]);
    const latches = new InMemoryCoordinationLatchStore();
    const key = {
      workspaceId: "nexo",
      reason: exhaustedMissionLatchReason("m-acked"),
    };
    await latches.tryAcquire(key);
    await latches.complete(key, "coord-already");

    const dispatcher = new CoordinationDispatcher(
      queue,
      { emit: () => {} },
      latches,
    );
    const result = await dispatcher.dispatch({
      workspaces: emptyWorkspaces,
      missions: failedScan({ missionId: "m-acked", needsCoordination: false }),
      queue: emptyQueue,
      recovery: emptyRecovery,
      healthOk: true,
    });

    expect(result.dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(0);
    expect(latches.getForTest(key)?.status).toBe("CONSUMED");
  });

  it("D — ciclo vazio nao apaga CONSUMED exhausted fora da janela de scan", async () => {
    const queue = createQueue();
    const latches = new InMemoryCoordinationLatchStore();
    const outOfWindow = {
      workspaceId: "nexo",
      reason: exhaustedMissionLatchReason("m-out-of-window"),
    };
    await latches.tryAcquire(outOfWindow);
    await latches.complete(outOfWindow, "coord-old");

    const dispatcher = new CoordinationDispatcher(
      queue,
      { emit: () => {} },
      latches,
    );
    const result = await dispatcher.dispatch({
      workspaces: emptyWorkspaces,
      missions: emptyMissions,
      queue: emptyQueue,
      recovery: emptyRecovery,
      healthOk: true,
    });

    expect(result.dispatched).toBe(0);
    expect(latches.getForTest(outOfWindow)?.status).toBe("CONSUMED");
    expect(await latches.isConsumed(outOfWindow)).toBe(true);
  });
});
