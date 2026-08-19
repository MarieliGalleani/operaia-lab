/**
 * Integration — CoordinationSignalLatch Prisma (PENDING/CONSUMED + concorrencia).
 */
import "../../operations/ensure-database-url.js";
import { prisma, CoordinationLatchStatus } from "@operaia/database";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import { PrismaCoordinationLatchStore } from "./infrastructure/prisma-coordination-latch-store.js";
import type { MissionQueuePort, MissionView } from "./ports.js";
import type { WorkspaceScanReport } from "./types.js";

const PREFIX = `latch-it-${Date.now()}`;

function createQueue(): MissionQueuePort & {
  enqueued: Array<{ workspaceId: string; objective: string }>;
} {
  const enqueued: Array<{ workspaceId: string; objective: string }> = [];
  return {
    enqueued,
    async depths() {
      return { queued: 0, running: 0, waiting: 0, failed: 0 };
    },
    async list() {
      return [] as MissionView[];
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
      enqueued.push({
        workspaceId: input.workspaceId,
        objective: input.objective,
      });
      return { created: true, id: `m-${enqueued.length}` };
    },
  };
}

function backlogReport(workspaceId: string): WorkspaceScanReport {
  return {
    scannedAt: new Date().toISOString(),
    activeCount: 1,
    readyCount: 1,
    attentionCount: 1,
    workspaces: [
      {
        workspaceId,
        name: workspaceId,
        status: "ACTIVE",
        projectId: workspaceId,
        pendingTasks: 2,
        teamSize: 1,
        hasActiveMission: false,
        hasBlockedMission: false,
        hasWaitingMission: false,
        hasReadyMission: false,
        hasBacklog: true,
        hasChanges: true,
        needsAttention: true,
        attentionReasons: ["backlog"],
        openMissions: 0,
        ready: true,
        issues: [],
      },
    ],
  };
}

const emptyMissions = {
  scannedAt: new Date().toISOString(),
  items: [] as const,
  resumableCount: 0,
  coordinationNeeded: 0,
  byStatus: {},
};

const idleQueue = {
  scannedAt: new Date().toISOString(),
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

const emptyRecovery = {
  recoveredAt: new Date().toISOString(),
  actions: [] as const,
  infraRecovered: 0,
  coordinationsRequested: 0,
};

describe("PrismaCoordinationLatchStore — PENDING/CONSUMED", () => {
  beforeEach(async () => {
    await prisma.coordinationSignalLatch.deleteMany({
      where: { workspaceId: { startsWith: PREFIX } },
    });
  });

  afterAll(async () => {
    await prisma.coordinationSignalLatch.deleteMany({
      where: { workspaceId: { startsWith: PREFIX } },
    });
    await prisma.$disconnect();
  });

  it("idempotencia: duas aquisições simultâneas — exatamente uma adquire, sem prisma:error", async () => {
    const workspaceId = `${PREFIX}-pair`;
    const store = new PrismaCoordinationLatchStore();
    const key = { workspaceId, reason: "backlog" };

    const prismaNoise: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      prismaNoise.push(args.map(String).join(" "));
      originalError(...args);
    };

    let results: Awaited<ReturnType<typeof store.tryAcquire>>[];
    try {
      results = await Promise.all([
        store.tryAcquire(key, { staleAfterMs: 60_000 }),
        store.tryAcquire(key, { staleAfterMs: 60_000 }),
      ]);
    } finally {
      console.error = originalError;
    }

    expect(results.filter((a) => a.acquired)).toHaveLength(1);
    expect(results.filter((a) => !a.acquired)).toHaveLength(1);
    expect(results.find((a) => a.acquired)?.mode).toBe("fresh");
    expect(
      prismaNoise.some(
        (line) =>
          line.includes("prisma:error") ||
          line.includes("Unique constraint failed"),
      ),
    ).toBe(false);

    const rows = await prisma.coordinationSignalLatch.findMany({
      where: { workspaceId, reason: "backlog" },
    });
    expect(rows).toHaveLength(1);
  });

  it("concorrencia: apenas um acquired; CONSUMED bloqueia restart", async () => {
    const workspaceId = `${PREFIX}-nexo`;
    const store = new PrismaCoordinationLatchStore();
    const key = { workspaceId, reason: "backlog" };

    const acquires = await Promise.all([
      store.tryAcquire(key, { staleAfterMs: 60_000 }),
      store.tryAcquire(key, { staleAfterMs: 60_000 }),
      store.tryAcquire(key, { staleAfterMs: 60_000 }),
      store.tryAcquire(key, { staleAfterMs: 60_000 }),
      store.tryAcquire(key, { staleAfterMs: 60_000 }),
      store.tryAcquire(key, { staleAfterMs: 60_000 }),
      store.tryAcquire(key, { staleAfterMs: 60_000 }),
      store.tryAcquire(key, { staleAfterMs: 60_000 }),
    ]);
    expect(acquires.filter((a) => a.acquired)).toHaveLength(1);

    await store.complete(key, "mission-1");
    const row = await prisma.coordinationSignalLatch.findUnique({
      where: { workspaceId_reason: { workspaceId, reason: "backlog" } },
    });
    expect(row?.status).toBe(CoordinationLatchStatus.CONSUMED);

    const queue = createQueue();
    const payload = {
      workspaces: backlogReport(workspaceId),
      missions: emptyMissions,
      queue: idleQueue,
      recovery: emptyRecovery,
      healthOk: true,
    };

    const d1 = new CoordinationDispatcher(queue, { emit() {} }, store, 60_000);
    expect((await d1.dispatch(payload)).dispatched).toBe(0);

    await store.release(key);
    const d2 = new CoordinationDispatcher(queue, { emit() {} }, store, 60_000);
    expect((await d2.dispatch(payload)).dispatched).toBe(1);

    const d3 = new CoordinationDispatcher(
      queue,
      { emit() {} },
      new PrismaCoordinationLatchStore(),
      60_000,
    );
    expect((await d3.dispatch(payload)).dispatched).toBe(0);
    expect(queue.enqueued).toHaveLength(1);
  });

  it("PENDING orfao stale e reclamado sem duplicar acquire fresco", async () => {
    const workspaceId = `${PREFIX}-orphan`;
    const store = new PrismaCoordinationLatchStore();
    const key = { workspaceId, reason: "backlog" };

    await prisma.coordinationSignalLatch.create({
      data: {
        workspaceId,
        reason: "backlog",
        status: CoordinationLatchStatus.PENDING,
        latchedAt: new Date(Date.now() - 120_000),
      },
    });
    // Prisma @updatedAt no create usa now(); forca updatedAt stale para reclaim.
    await prisma.$executeRaw`
      UPDATE coordination_signal_latches
      SET "updatedAt" = NOW() - INTERVAL '120 seconds',
          "latchedAt" = NOW() - INTERVAL '120 seconds'
      WHERE "workspaceId" = ${workspaceId} AND reason = 'backlog'
    `;

    const fresh = await store.tryAcquire(key, { staleAfterMs: 60_000 });
    expect(fresh.acquired).toBe(true);

    const concurrent = await store.tryAcquire(key, { staleAfterMs: 60_000 });
    expect(concurrent.acquired).toBe(false);

    await store.complete(key, "recovered-mission");
    const held = await store.tryAcquire(key, { staleAfterMs: 0 });
    expect(held.acquired).toBe(false);
  });

  it("releaseAbsent libera latch quando sinal some", async () => {
    const workspaceId = `${PREFIX}-release`;
    const store = new PrismaCoordinationLatchStore();
    const queue = createQueue();
    const present = {
      workspaces: backlogReport(workspaceId),
      missions: emptyMissions,
      queue: idleQueue,
      recovery: emptyRecovery,
      healthOk: true,
    };
    const absent = {
      ...present,
      workspaces: {
        ...present.workspaces,
        attentionCount: 0,
        workspaces: present.workspaces.workspaces.map((w) => ({
          ...w,
          needsAttention: false,
          attentionReasons: [] as const,
          pendingTasks: 0,
          hasBacklog: false,
        })),
      },
    };

    const dispatcher = new CoordinationDispatcher(
      queue,
      { emit() {} },
      store,
      60_000,
    );
    expect((await dispatcher.dispatch(present)).dispatched).toBe(1);
    expect((await dispatcher.dispatch(present)).dispatched).toBe(0);
    expect((await dispatcher.dispatch(absent)).dispatched).toBe(0);
    expect((await dispatcher.dispatch(present)).dispatched).toBe(1);
    expect(queue.enqueued).toHaveLength(2);
  });
});
