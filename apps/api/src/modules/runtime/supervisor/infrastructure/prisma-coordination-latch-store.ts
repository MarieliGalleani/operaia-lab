/**
 * Adapter Prisma — CoordinationSignalLatch (PENDING/CONSUMED + reclaim orfao stale).
 */
import { randomUUID } from "node:crypto";
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
import {
  coordinationLatchKeyOf,
  EXHAUSTED_MISSION_LATCH_PREFIX,
  shouldPreserveConsumedExhaustedLatch,
} from "../coordination-latch-store.js";

type LatchRow = {
  id: string;
  latchedAt: Date;
  status: string;
  lastMissionId: string | null;
};

function isWorkspaceReasonUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.["target"];
  if (!Array.isArray(target)) {
    // Sem meta.target: ainda e P2002 neste create unico (workspaceId, reason).
    return true;
  }
  return target.includes("workspaceId") && target.includes("reason");
}

export class PrismaCoordinationLatchStore implements CoordinationLatchPort {
  async tryAcquire(
    key: CoordinationLatchKey,
    options?: CoordinationAcquireOptions,
  ): Promise<CoordinationAcquireResult> {
    const staleAfterMs = options?.staleAfterMs ?? 60_000;
    try {
      // INSERT ... ON CONFLICT DO NOTHING: vencedor recebe RETURNING;
      // perdedor nao gera P2002 / prisma:error (idempotencia sob corrida).
      const inserted = await prisma.$queryRaw<LatchRow[]>`
        INSERT INTO coordination_signal_latches (
          id, "workspaceId", reason, status, "latchedAt", "createdAt", "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${key.workspaceId},
          ${key.reason},
          'PENDING'::"CoordinationLatchStatus",
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT ("workspaceId", reason) DO NOTHING
        RETURNING id, "latchedAt", status::text AS status, "lastMissionId"
      `;

      if (inserted[0]) {
        return {
          acquired: true,
          latchedAt: inserted[0].latchedAt,
          mode: "fresh",
        };
      }

      return this.onConflict(key, staleAfterMs);
    } catch (error) {
      // Defesa: se algum caminho ainda levantar P2002 da unique (workspaceId, reason).
      if (isWorkspaceReasonUniqueViolation(error)) {
        return this.onConflict(key, staleAfterMs);
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
    const rows = await prisma.coordinationSignalLatch.findMany({
      select: { id: true, workspaceId: true, reason: true, status: true },
    });
    const keep = new Set(active.map(coordinationLatchKeyOf));
    const staleIds = rows
      .filter((row) => {
        if (
          keep.has(
            coordinationLatchKeyOf({
              workspaceId: row.workspaceId,
              reason: row.reason,
            }),
          )
        ) {
          return false;
        }
        return !shouldPreserveConsumedExhaustedLatch({
          reason: row.reason,
          status: row.status,
        });
      })
      .map((row) => row.id);

    if (staleIds.length === 0) {
      return;
    }

    await prisma.coordinationSignalLatch.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  async releaseAll(): Promise<void> {
    await prisma.coordinationSignalLatch.deleteMany({
      where: {
        NOT: {
          AND: [
            { status: CoordinationLatchStatus.CONSUMED },
            { reason: { startsWith: EXHAUSTED_MISSION_LATCH_PREFIX } },
          ],
        },
      },
    });
  }

  async isConsumed(key: CoordinationLatchKey): Promise<boolean> {
    const row = await prisma.coordinationSignalLatch.findUnique({
      where: {
        workspaceId_reason: {
          workspaceId: key.workspaceId,
          reason: key.reason,
        },
      },
      select: { status: true },
    });
    return row?.status === CoordinationLatchStatus.CONSUMED;
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
