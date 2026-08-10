/**
 * Adapter Prisma — CoordinationSignalLatch (PENDING/CONSUMED + reclaim orfao stale).
 */
import {
  prisma,
  Prisma,
  CoordinationLatchStatus,
} from "@operaia/database";
import type {
  CoordinationAcquireOptions,
  CoordinationAcquireResult,
  CoordinationLatchKey,
  CoordinationLatchPort,
} from "../coordination-latch-store.js";
import { coordinationLatchKeyOf } from "../coordination-latch-store.js";

type LatchRow = {
  id: string;
  latchedAt: Date;
  status: string;
  lastMissionId: string | null;
};

export class PrismaCoordinationLatchStore implements CoordinationLatchPort {
  async tryAcquire(
    key: CoordinationLatchKey,
    options?: CoordinationAcquireOptions,
  ): Promise<CoordinationAcquireResult> {
    try {
      const row = await prisma.coordinationSignalLatch.create({
        data: {
          workspaceId: key.workspaceId,
          reason: key.reason,
          status: CoordinationLatchStatus.PENDING,
        },
      });
      return { acquired: true, latchedAt: row.latchedAt, mode: "fresh" };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return this.onConflict(key, options?.staleAfterMs ?? 60_000);
      }
      throw error;
    }
  }

  private async onConflict(
    key: CoordinationLatchKey,
    staleAfterMs: number,
  ): Promise<CoordinationAcquireResult> {
    const row = await prisma.coordinationSignalLatch.findUnique({
      where: {
        workspaceId_reason: {
          workspaceId: key.workspaceId,
          reason: key.reason,
        },
      },
    });

    if (!row) {
      return this.tryAcquire(key, { staleAfterMs });
    }

    if (row.status === CoordinationLatchStatus.CONSUMED) {
      return { acquired: false };
    }

    if (row.lastMissionId) {
      await prisma.coordinationSignalLatch.update({
        where: { id: row.id },
        data: { status: CoordinationLatchStatus.CONSUMED },
      });
      return { acquired: false };
    }

    const ageMs = Date.now() - row.updatedAt.getTime();
    if (ageMs < staleAfterMs) {
      // PENDING fresco = acquire in-flight de outra instancia (ou reclaim recente).
      return { acquired: false };
    }

    return this.reclaimStalePending(key);
  }

  /**
   * Reclaim atomico de PENDING orfao stale.
   * FOR UPDATE SKIP LOCKED: no maximo uma instancia reclama.
   */
  private async reclaimStalePending(
    key: CoordinationLatchKey,
  ): Promise<CoordinationAcquireResult> {
    const claimed = await prisma.$queryRaw<LatchRow[]>`
      UPDATE coordination_signal_latches
      SET "updatedAt" = NOW()
      WHERE id = (
        SELECT id FROM coordination_signal_latches
        WHERE "workspaceId" = ${key.workspaceId}
          AND reason = ${key.reason}
          AND status = 'PENDING'::"CoordinationLatchStatus"
          AND "lastMissionId" IS NULL
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, "latchedAt", status::text AS status, "lastMissionId"
    `;

    if (claimed[0]) {
      return {
        acquired: true,
        latchedAt: claimed[0].latchedAt,
        mode: "reclaim",
      };
    }

    return { acquired: false };
  }

  async release(key: CoordinationLatchKey): Promise<void> {
    await prisma.coordinationSignalLatch.deleteMany({
      where: {
        workspaceId: key.workspaceId,
        reason: key.reason,
      },
    });
  }

  async releaseAbsent(active: readonly CoordinationLatchKey[]): Promise<void> {
    if (active.length === 0) {
      await this.releaseAll();
      return;
    }

    const rows = await prisma.coordinationSignalLatch.findMany({
      select: { id: true, workspaceId: true, reason: true },
    });
    const keep = new Set(active.map(coordinationLatchKeyOf));
    const staleIds = rows
      .filter(
        (row) =>
          !keep.has(
            coordinationLatchKeyOf({
              workspaceId: row.workspaceId,
              reason: row.reason,
            }),
          ),
      )
      .map((row) => row.id);

    if (staleIds.length === 0) {
      return;
    }

    await prisma.coordinationSignalLatch.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  async releaseAll(): Promise<void> {
    await prisma.coordinationSignalLatch.deleteMany({});
  }

  async complete(
    key: CoordinationLatchKey,
    missionId: string,
  ): Promise<void> {
    await prisma.coordinationSignalLatch.updateMany({
      where: {
        workspaceId: key.workspaceId,
        reason: key.reason,
      },
      data: {
        status: CoordinationLatchStatus.CONSUMED,
        lastMissionId: missionId,
      },
    });
  }
}
