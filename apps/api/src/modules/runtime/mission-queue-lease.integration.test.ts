/**
 * MQ-2 — ownership de execucao via leaseVersion (MissionQueue).
 * Integration Prisma: claim / complete / fail / recover / SKIP LOCKED.
 */
import "../operations/ensure-database-url.js";
import { MissionStatus, prisma } from "@operaia/database";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  MissionQueue,
  StaleMissionOwnershipError,
} from "./mission-queue.js";
import { CEO_EMPLOYEE_ID } from "./mission-states.js";

const PREFIX = `mq2-lease-${Date.now()}`;
const WS = `${PREFIX}-ws`;

const CEO_CLAIM = {
  employeeId: CEO_EMPLOYEE_ID,
  specialization: "MANAGEMENT",
} as const;

describe("MissionQueue MQ-2 — leaseVersion ownership", () => {
  const queue = new MissionQueue();

  beforeEach(async () => {
    await prisma.missionEvent.deleteMany({
      where: { mission: { workspaceId: { startsWith: PREFIX } } },
    });
    await prisma.mission.deleteMany({
      where: { workspaceId: { startsWith: PREFIX } },
    });
  });

  afterAll(async () => {
    await prisma.missionEvent.deleteMany({
      where: { mission: { workspaceId: { startsWith: PREFIX } } },
    });
    await prisma.mission.deleteMany({
      where: { workspaceId: { startsWith: PREFIX } },
    });
    await prisma.$disconnect();
  });

  async function enqueueCoord(suffix: string) {
    const { mission } = await queue.enqueue({
      workspaceId: WS,
      objective: `${PREFIX} ${suffix}`,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: false,
    });
    expect(mission.leaseVersion).toBe(0);
    expect(mission.status).toBe(MissionStatus.QUEUED);
    return mission;
  }

  it("Teste 3 — cada claim produz leaseVersion distinta", async () => {
    const seeded = await enqueueCoord("claim-increment");
    const first = await queue.claim(CEO_CLAIM);
    expect(first?.id).toBe(seeded.id);
    expect(first?.leaseVersion).toBe(1);
    expect(first?.attempt).toBe(1);

    await queue.fail(first!.id, "retry para segundo claim", first!.leaseVersion);
    const afterFail = await prisma.mission.findUniqueOrThrow({
      where: { id: seeded.id },
    });
    expect(afterFail.status).toBe(MissionStatus.QUEUED);
    expect(afterFail.leaseVersion).toBe(1);

    await prisma.mission.update({
      where: { id: seeded.id },
      data: { scheduledAt: new Date() },
    });

    const second = await queue.claim(CEO_CLAIM);
    expect(second?.id).toBe(seeded.id);
    expect(second?.leaseVersion).toBe(2);
    expect(second?.attempt).toBe(2);
    expect(second?.leaseVersion).not.toBe(first!.leaseVersion);
  });

  it("Teste 1 — stale complete apos reclaim e rejeitado", async () => {
    await enqueueCoord("stale-complete");
    const workerA = await queue.claim(CEO_CLAIM);
    expect(workerA).toBeTruthy();
    const leaseA = workerA!.leaseVersion;

    const recovered = await queue.recoverStaleRunning(0);
    expect(recovered).toBeGreaterThanOrEqual(1);

    const afterRecover = await prisma.mission.findUniqueOrThrow({
      where: { id: workerA!.id },
    });
    expect(afterRecover.status).toBe(MissionStatus.QUEUED);
    expect(afterRecover.leaseVersion).toBe(leaseA + 1);

    const workerB = await queue.claim(CEO_CLAIM);
    expect(workerB?.id).toBe(workerA!.id);
    expect(workerB!.leaseVersion).toBe(leaseA + 2);

    await expect(
      queue.complete(workerA!.id, { ok: false }, leaseA),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);

    const stillB = await prisma.mission.findUniqueOrThrow({
      where: { id: workerB!.id },
    });
    expect(stillB.status).toBe(MissionStatus.RUNNING);
    expect(stillB.leaseVersion).toBe(workerB!.leaseVersion);

    await queue.complete(workerB!.id, { ok: true }, workerB!.leaseVersion);
    const done = await prisma.mission.findUniqueOrThrow({
      where: { id: workerB!.id },
    });
    expect(done.status).toBe(MissionStatus.COMPLETED);
  });

  it("Teste 2 — stale fail apos reclaim e rejeitado", async () => {
    await enqueueCoord("stale-fail");
    const workerA = await queue.claim(CEO_CLAIM);
    const leaseA = workerA!.leaseVersion;
    const lastErrorBefore = workerA!.lastError;

    await queue.recoverStaleRunning(0);
    const workerB = await queue.claim(CEO_CLAIM);
    expect(workerB!.leaseVersion).toBe(leaseA + 2);

    await expect(
      queue.fail(workerA!.id, "falha fantasma do worker A", leaseA),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);

    const stillB = await prisma.mission.findUniqueOrThrow({
      where: { id: workerB!.id },
    });
    expect(stillB.status).toBe(MissionStatus.RUNNING);
    expect(stillB.leaseVersion).toBe(workerB!.leaseVersion);
    expect(stillB.lastError).toBe(lastErrorBefore ?? stillB.lastError);
    // lastError de recover permanece; fail de A nao sobrescreve com "falha fantasma"
    expect(stillB.lastError).not.toBe("falha fantasma do worker A");
  });

  it("Teste 4 — mesmo lease nao completa se status != RUNNING", async () => {
    await enqueueCoord("status-guard");
    const claimed = await queue.claim(CEO_CLAIM);
    await queue.complete(claimed!.id, { done: true }, claimed!.leaseVersion);

    await expect(
      queue.complete(claimed!.id, { again: true }, claimed!.leaseVersion),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);
  });

  it("Teste 5 — recovery RUNNING(N) → QUEUED(N+1) invalida ownership", async () => {
    await enqueueCoord("recover-invalidate");
    const claimed = await queue.claim(CEO_CLAIM);
    const n = claimed!.leaseVersion;

    const recovered = await queue.recoverStaleRunning(0);
    expect(recovered).toBe(1);

    const row = await prisma.mission.findUniqueOrThrow({
      where: { id: claimed!.id },
    });
    expect(row.status).toBe(MissionStatus.QUEUED);
    expect(row.leaseVersion).toBe(n + 1);

    await expect(
      queue.complete(claimed!.id, { x: 1 }, n),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);
    await expect(
      queue.fail(claimed!.id, "stale", n),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);
    await expect(
      queue.markWaiting(claimed!.id, { phase: "coordinated" }, n),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);
  });

  it("Teste 6+7 — retry legítimo, novo lease, attempt/maxAttempts e backoff", async () => {
    const seeded = await enqueueCoord("retry-backoff");
    await prisma.mission.update({
      where: { id: seeded.id },
      data: { maxAttempts: 3 },
    });

    const first = await queue.claim(CEO_CLAIM);
    expect(first!.attempt).toBe(1);
    expect(first!.leaseVersion).toBe(1);

    const beforeFail = Date.now();
    const failed = await queue.fail(
      first!.id,
      "erro recuperavel",
      first!.leaseVersion,
    );
    expect(failed.status).toBe(MissionStatus.QUEUED);
    expect(failed.attempt).toBe(1);
    expect(failed.leaseVersion).toBe(1);
    expect(failed.lastError).toBe("erro recuperavel");
    expect(failed.scheduledAt).toBeTruthy();
    expect(failed.scheduledAt!.getTime()).toBeGreaterThanOrEqual(
      beforeFail + 4_000,
    );

    await prisma.mission.update({
      where: { id: seeded.id },
      data: { scheduledAt: new Date() },
    });

    const second = await queue.claim(CEO_CLAIM);
    expect(second!.attempt).toBe(2);
    expect(second!.leaseVersion).toBe(2);

    await queue.fail(second!.id, "ainda falha", second!.leaseVersion);
    await prisma.mission.update({
      where: { id: seeded.id },
      data: { scheduledAt: new Date() },
    });
    const third = await queue.claim(CEO_CLAIM);
    expect(third!.attempt).toBe(3);
    const terminal = await queue.fail(
      third!.id,
      "esgotou",
      third!.leaseVersion,
    );
    expect(terminal.status).toBe(MissionStatus.FAILED);
    expect(terminal.attempt).toBe(3);
  });

  it("Teste 8 — claim concorrente: SKIP LOCKED entrega no maximo 1", async () => {
    await enqueueCoord("skip-locked");
    const claims = await Promise.all([
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
      queue.claim(CEO_CLAIM),
    ]);
    const won = claims.filter((c) => c !== null);
    expect(won).toHaveLength(1);
    expect(won[0]!.leaseVersion).toBe(1);
  });

  it("Teste 9 — StaleMissionOwnershipError e deterministico", async () => {
    await enqueueCoord("deterministic-error");
    const claimed = await queue.claim(CEO_CLAIM);
    await queue.recoverStaleRunning(0);

    try {
      await queue.complete(claimed!.id, {}, claimed!.leaseVersion);
      expect.unreachable("deveria rejeitar");
    } catch (error) {
      expect(error).toBeInstanceOf(StaleMissionOwnershipError);
      const stale = error as StaleMissionOwnershipError;
      expect(stale.name).toBe("StaleMissionOwnershipError");
      expect(stale.missionId).toBe(claimed!.id);
      expect(stale.expectedLeaseVersion).toBe(claimed!.leaseVersion);
      expect(stale.message).toContain(claimed!.id);
    }
  });

  it("markWaiting exige lease RUNNING valido", async () => {
    await enqueueCoord("mark-waiting");
    const claimed = await queue.claim(CEO_CLAIM);
    const waiting = await queue.markWaiting(
      claimed!.id,
      { phase: "coordinated" },
      claimed!.leaseVersion,
    );
    expect(waiting.status).toBe(MissionStatus.WAITING);

    await expect(
      queue.markWaiting(claimed!.id, { again: true }, claimed!.leaseVersion),
    ).rejects.toBeInstanceOf(StaleMissionOwnershipError);
  });
});
