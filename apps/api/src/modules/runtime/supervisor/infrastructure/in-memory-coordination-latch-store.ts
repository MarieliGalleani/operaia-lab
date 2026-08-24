/**
 * Latch COORDINATE em memoria — apenas testes / harness local.
 */
import type {
  CoordinationAcquireOptions,
  CoordinationAcquireResult,
  CoordinationLatchKey,
  CoordinationLatchPort,
} from "../coordination-latch-store.js";
import {
  coordinationLatchKeyOf,
  shouldPreserveConsumedExhaustedLatch,
} from "../coordination-latch-store.js";

type LatchRecord = {
  readonly key: CoordinationLatchKey;
  status: "PENDING" | "CONSUMED";
  latchedAt: Date;
  updatedAt: Date;
  lastMissionId?: string;
};

export class InMemoryCoordinationLatchStore implements CoordinationLatchPort {
  private readonly latches = new Map<string, LatchRecord>();

  async tryAcquire(
    key: CoordinationLatchKey,
    options?: CoordinationAcquireOptions,
  ): Promise<CoordinationAcquireResult> {
    const staleAfterMs = options?.staleAfterMs ?? 60_000;
    const id = coordinationLatchKeyOf(key);
    const existing = this.latches.get(id);

    if (!existing) {
      const now = new Date();
      this.latches.set(id, {
        key,
        status: "PENDING",
        latchedAt: now,
        updatedAt: now,
      });
      return { acquired: true, latchedAt: now, mode: "fresh" };
    }

    if (existing.status === "CONSUMED") {
      return { acquired: false };
    }

    if (existing.lastMissionId) {
      existing.status = "CONSUMED";
      return { acquired: false };
    }

    const ageMs = Date.now() - existing.updatedAt.getTime();
    if (ageMs < staleAfterMs) {
      return { acquired: false };
    }

    // Reclaim: preserva latchedAt original; atualiza updatedAt.
    existing.updatedAt = new Date();
    return {
      acquired: true,
      latchedAt: existing.latchedAt,
      mode: "reclaim",
    };
  }

  async release(key: CoordinationLatchKey): Promise<void> {
    this.latches.delete(coordinationLatchKeyOf(key));
  }

  async releaseAbsent(active: readonly CoordinationLatchKey[]): Promise<void> {
    const keep = new Set(active.map(coordinationLatchKeyOf));
    for (const [id, record] of [...this.latches.entries()]) {
      if (keep.has(id)) {
        continue;
      }
      if (
        shouldPreserveConsumedExhaustedLatch({
          reason: record.key.reason,
          status: record.status,
        })
      ) {
        continue;
      }
      this.latches.delete(id);
    }
  }

  async releaseAll(): Promise<void> {
    for (const [id, record] of [...this.latches.entries()]) {
      if (
        shouldPreserveConsumedExhaustedLatch({
          reason: record.key.reason,
          status: record.status,
        })
      ) {
        continue;
      }
      this.latches.delete(id);
    }
  }

  async isConsumed(key: CoordinationLatchKey): Promise<boolean> {
    const current = this.latches.get(coordinationLatchKeyOf(key));
    return current?.status === "CONSUMED";
  }

  async complete(
    key: CoordinationLatchKey,
    missionId: string,
  ): Promise<void> {
    const id = coordinationLatchKeyOf(key);
    const current = this.latches.get(id);
    if (!current) {
      return;
    }
    const now = new Date();
    this.latches.set(id, {
      key: current.key,
      status: "CONSUMED",
      latchedAt: current.latchedAt,
      updatedAt: now,
      lastMissionId: missionId,
    });
  }

  getForTest(key: CoordinationLatchKey): LatchRecord | undefined {
    return this.latches.get(coordinationLatchKeyOf(key));
  }

  /** Simula crash apos acquire: PENDING sem missao, timestamps no passado. */
  leavePendingOrphanForTest(
    key: CoordinationLatchKey,
    latchedAt = new Date(Date.now() - 120_000),
  ): void {
    this.latches.set(coordinationLatchKeyOf(key), {
      key,
      status: "PENDING",
      latchedAt,
      updatedAt: latchedAt,
      lastMissionId: undefined,
    });
  }
}
