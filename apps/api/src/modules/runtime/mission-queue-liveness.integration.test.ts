/**
 * MQ-3 — liveness via WorkerHeartbeat (MissionQueue recover / abandono).
 */
import "../operations/ensure-database-url.js";
import { MissionStatus, prisma } from "@operaia/database";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  MissionQueue,
  StaleMissionOwnershipError,
} from "./mission-queue.js";
import { CEO_EMPLOYEE_ID } from "./mission-states.js";
import {
  isRunningMissionAbandoned,
  resolveWorkerLivenessMs,
  WORKER_LIVENESS_MISSED_HEARTBEATS,
} from "./worker-liveness.js";

const PREFIX = `mq3-live-${Date.now()}`;
const WS = `${PREFIX}-ws`;
const CEO_CLAIM = {
  employeeId: CEO_EMPLOYEE_ID,
  specialization: "MANAGEMENT",
} as const;

describe("worker-liveness helpers", () => {
  it("resolveWorkerLivenessMs = N × heartbeat", () => {
    expect(WORKER_LIVENESS_MISSED_HEARTBEATS).toBe(3);
    expect(resolveWorkerLivenessMs(5_000)).toBe(15_000);
  });

  it("heartbeat fresco + currentMissionId match = vivo", () => {
    expect(
      isRunningMissionAbandoned({
        missionId: "m1",
        heartbeat: {
          currentMissionId: "m1",
          lastSeenAt: new Date(),
        },
        nowMs: Date.now(),
        livenessMs: 15_000,
      }),
    ).toBe(false);
  });

  it("owner mismatch (currentMissionId diferente) = abandonado", () => {
    expect(
      isRunningMissionAbandoned({
        missionId: "m1",
        heartbeat: {
          currentMissionId: "m-other",
          lastSeenAt: new Date(),
        },
        nowMs: Date.now(),
        livenessMs: 15_000,
      }),
    ).toBe(true);
  });

  it("lastSeenAt stale = abandonado", () => {
    const nowMs = Date.now();
    expect(
      isRunningMissionAbandoned({
        missionId: "m1",
        heartbeat: {
          currentMissionId: "m1",
          lastSeenAt: new Date(nowMs - 20_000),
        },
        nowMs,
        livenessMs: 15_000,
      }),
    ).toBe(true);
  });

  it("sem heartbeat = abandonado", () => {
    expect(
      isRunningMissionAbandoned({
        missionId: "m1",
        heartbeat: null,
        nowMs: Date.now(),
        livenessMs: 15_000,
      }),
    ).toBe(true);
  });

  it("livenessMs <= 0 forca abandono", () => {
    expect(
      isRunningMissionAbandoned({
        missionId: "m1",
        heartbeat: {
          currentMissionId: "m1",
          lastSeenAt: new Date(),
        },
        nowMs: Date.now(),
        livenessMs: 0,
      }),
    ).toBe(true);
  });
});

describe("MissionQueue MQ-3 — heartbeat liveness recovery", () => {
  const queue = new MissionQueue();

  beforeEach(async () => {
    await prisma.missionEvent.deleteMany({
      where: { mission: { workspaceId: { startsWith: PREFIX } } },
    });
    await prisma.mission.deleteMany({
      where: { workspaceId: { startsWith: PREFIX } },
    });
    await prisma.workerHeartbeat.deleteMany({
      where: { employeeId: { startsWith: PREFIX } },
    });
    await prisma.workerHeartbeat.deleteMany({
      where: { employeeId: CEO_EMPLOYEE_ID },
    });
  });

  afterAll(async () => {
    await prisma.missionEvent.deleteMany({
      where: { mission: { workspaceId: { startsWith: PREFIX } } },
    });
    await prisma.mission.deleteMany({
      where: { workspaceId: { startsWith: PREFIX } },
    });
    await prisma.workerHeartbeat.deleteMany({
      where: { employeeId: CEO_EMPLOYEE_ID },
    });
    await prisma.$disconnect();
  });

  async function enqueueAndClaim(suffix: string) {
    const { mission } = await queue.enqueue({
      workspaceId: WS,
      objective: `${PREFIX} ${suffix}`,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: false,
    });
    const claimed = await queue.claim(CEO_CLAIM);
    expect(claimed?.id).toBe(mission.id);
    return claimed!;
  }

  async function pulseAlive(missionId: string): Promise<void> {
    const now = new Date();
    await prisma.workerHeartbeat.upsert({
      where: { employeeId: CEO_EMPLOYEE_ID },
      create: {
        employeeId: CEO_EMPLOYEE_ID,
        status: "busy",
        currentMissionId: missionId,
        startedAt: now,
        lastSeenAt: now,
      },
      update: {
        status: "busy",
        currentMissionId: missionId,
        lastSeenAt: now,
      },
    });
  }

  async function markDead(
    missionId: string | null,
    ageMs: number,
  ): Promise<void> {
    const staleAt = new Date(Date.now() - ageMs);
    await prisma.workerHeartbeat.upsert({
      where: { employeeId: CEO_EMPLOYEE_ID },
      create: {
        employeeId: CEO_EMPLOYEE_ID,
        status: "stopped",
        currentMissionId: missionId,
        startedAt: staleAt,
        lastSeenAt: staleAt,
      },
      update: {
        status: "stopped",
        currentMissionId: missionId,
        lastSeenAt: staleAt,
      },
    });
  }

  it("1 — worker saudavel: updatedAt antigo + HB fresco → NAO recupera", async () => {
    const claimed = await enqueueAndClaim("long-alive");
    await pulseAlive(claimed.id);

    // Simula Mission.updatedAt antigo (nao deve influenciar MQ-3).
    await prisma.$executeRaw`
      UPDATE missions
      SET "updatedAt" = NOW() - INTERVAL '2 hours'
      WHERE id = ${claimed.id}
    `;

    const recovered = await queue.recoverStaleRunning(15_000);
    expect(recovered).toBe(0);
    const row = await prisma.mission.findUniqueOrThrow({
      where: { id: claimed.id },
    });
    expect(row.status).toBe(MissionStatus.RUNNING);
    expect(row.leaseVersion).toBe(claimed.leaseVersion);
  });

  it("2 — worker morto: HB stale → recupera + lease++", async () => {
    const claimed = await enqueueAndClaim("dead-worker");
    const lease = claimed.leaseVersion;
    await markDead(claimed.id, 60_000);

    const recovered = await queue.recoverStaleRunning(15_000);
    expect(recovered).toBe(1);
    const row = await prisma.mission.findUniqueOrThrow({
      where: { id: claimed.id },
    });
    expect(row.status).toBe(MissionStatus.QUEUED);
    expect(row.leaseVersion).toBe(lease + 1);
  });

  it("5 — HB fresco com currentMissionId mismatch → recupera", async () => {
    const claimed = await enqueueAndClaim("mismatch");
    await pulseAlive("outra-missao");

    const recovered = await queue.recoverStaleRunning(15_000);
    expect(recovered).toBe(1);
    const row = await prisma.mission.findUniqueOrThrow({
      where: { id: claimed.id },
    });
    expect(row.status).toBe(MissionStatus.QUEUED);
  });

  it("6 — HB stale: RUNNING→QUEUED lease++", async () => {
    const claimed = await enqueueAndClaim("stale-hb");
    await markDead(claimed.id, 30_000);
    const before = claimed.leaseVersion;
    expect(await queue.recoverStaleRunning(10_000)).toBe(1);
    const row = await prisma.mission.findUniqueOrThrow({
      where: { id: claimed.id },
    });
    expect(row.leaseVersion).toBe(before + 1);
  });

  it("7 — dual recovery: so um update efetivo", async () => {
    const claimed = await enqueueAndClaim("dual-recover");
    await markDead(claimed.id, 60_000);
    const results = await Promise.all([
      queue.recoverStaleRunning(15_000),
      queue.recoverStaleRunning(15_000),
      queue.recoverStaleRunning(15_000),
    ]);
    expect(results.reduce((a, b) => a + b, 0)).toBe(1);
    const row = await prisma.mission.findUniqueOrThrow({
      where: { id: claimed.id },
    });
    expect(row.status).toBe(MissionStatus.QUEUED);
    expect(row.leaseVersion).toBe(claimed.leaseVersion + 1);
  });

  it("8+9 — recovery vs complete: um vence; stale finalize rejeitado", async () => {
    const claimed = await enqueueAndClaim("race-complete");
    const leaseA = claimed.leaseVersion;
    await markDead(claimed.id, 60_000);

    const recovered = await queue.recoverStaleRunning(15_000);
    expect(recovered).toBe(1);

    await expect(
      queue.complete(claimed.id, { ok: false }, leaseA),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);

    const workerB = await queue.claim(CEO_CLAIM);
    expect(workerB?.id).toBe(claimed.id);
    expect(workerB!.leaseVersion).toBe(leaseA + 2);

    await expect(
      queue.fail(claimed.id, "fantasma", leaseA),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);

    await queue.complete(workerB!.id, { ok: true }, workerB!.leaseVersion);
  });

  it("10+11 — retry / maxAttempts / lease intactos sob liveness", async () => {
    const claimed = await enqueueAndClaim("retry");
    await pulseAlive(claimed.id);
    expect(await queue.recoverStaleRunning(15_000)).toBe(0);

    const failed = await queue.fail(
      claimed.id,
      "erro",
      claimed.leaseVersion,
    );
    expect(failed.status).toBe(MissionStatus.QUEUED);
    expect(failed.attempt).toBe(1);
    expect(failed.leaseVersion).toBe(claimed.leaseVersion);

    await prisma.mission.update({
      where: { id: claimed.id },
      data: { scheduledAt: new Date(), maxAttempts: 2 },
    });
    const second = await queue.claim(CEO_CLAIM);
    expect(second!.attempt).toBe(2);
    expect(second!.leaseVersion).toBe(claimed.leaseVersion + 1);
    const terminal = await queue.fail(
      second!.id,
      "fim",
      second!.leaseVersion,
    );
    expect(terminal.status).toBe(MissionStatus.FAILED);
  });

  it("12 — claim concorrente SKIP LOCKED", async () => {
    await queue.enqueue({
      workspaceId: WS,
      objective: `${PREFIX} skip`,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: false,
    });
    const claims = await Promise.all([
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
    ]);
    expect(claims.filter((c) => c !== null)).toHaveLength(1);
  });

  it("sem heartbeat row → abandonado", async () => {
    const claimed = await enqueueAndClaim("no-hb");
    await prisma.workerHeartbeat.deleteMany({
      where: { employeeId: CEO_EMPLOYEE_ID },
    });
    expect(await queue.recoverStaleRunning(15_000)).toBe(1);
    const row = await prisma.mission.findUniqueOrThrow({
      where: { id: claimed.id },
    });
    expect(row.status).toBe(MissionStatus.QUEUED);
  });
});
