/**
 * P0.2H-POST.1A — latch store: isConsumed + preservacao missao_esgotada CONSUMED.
 */
import { describe, expect, it } from "vitest";
import {
  exhaustedMissionLatchReason,
  isExhaustedMissionLatchReason,
  shouldPreserveConsumedExhaustedLatch,
} from "./coordination-latch-store.js";
import { InMemoryCoordinationLatchStore } from "./infrastructure/in-memory-coordination-latch-store.js";

describe("CoordinationLatchStore — isConsumed / preservacao", () => {
  it("isConsumed distingue OPEN, ausente e CONSUMED", async () => {
    const store = new InMemoryCoordinationLatchStore();
    const key = { workspaceId: "nexo", reason: "missao_esgotada:m-1" };

    expect(await store.isConsumed(key)).toBe(false);
    await store.tryAcquire(key);
    expect(await store.isConsumed(key)).toBe(false);
    await store.complete(key, "coord-1");
    expect(await store.isConsumed(key)).toBe(true);
  });

  it("D — releaseAll nao apaga CONSUMED missao_esgotada auditavel", async () => {
    const store = new InMemoryCoordinationLatchStore();
    const exhausted = {
      workspaceId: "nexo",
      reason: exhaustedMissionLatchReason("m-dead"),
    };
    const backlog = { workspaceId: "nexo", reason: "backlog" };
    const pendingExhausted = {
      workspaceId: "nexo",
      reason: exhaustedMissionLatchReason("m-pending"),
    };

    await store.tryAcquire(exhausted);
    await store.complete(exhausted, "coord-dead");
    await store.tryAcquire(backlog);
    await store.complete(backlog, "coord-backlog");
    await store.tryAcquire(pendingExhausted);

    await store.releaseAll();

    expect(store.getForTest(exhausted)?.status).toBe("CONSUMED");
    expect(await store.isConsumed(exhausted)).toBe(true);
    expect(store.getForTest(backlog)).toBeUndefined();
    expect(store.getForTest(pendingExhausted)).toBeUndefined();
  });

  it("D — releaseAbsent([]) nao apaga CONSUMED exhausted fora da janela", async () => {
    const store = new InMemoryCoordinationLatchStore();
    const outOfWindow = {
      workspaceId: "nexo",
      reason: exhaustedMissionLatchReason("m-out-of-window"),
    };
    const otherConsumed = { workspaceId: "nexo", reason: "backlog" };

    await store.tryAcquire(outOfWindow);
    await store.complete(outOfWindow, "coord-old");
    await store.tryAcquire(otherConsumed);
    await store.complete(otherConsumed, "coord-backlog");

    await store.releaseAbsent([]);

    expect(store.getForTest(outOfWindow)?.status).toBe("CONSUMED");
    expect(store.getForTest(otherConsumed)).toBeUndefined();
  });

  it("helpers: CONSUMED so se preserva com prefixo missao_esgotada:", () => {
    expect(isExhaustedMissionLatchReason("missao_esgotada:m-1")).toBe(true);
    expect(isExhaustedMissionLatchReason("backlog")).toBe(false);
    expect(
      shouldPreserveConsumedExhaustedLatch({
        reason: "missao_esgotada:m-1",
        status: "CONSUMED",
      }),
    ).toBe(true);
    expect(
      shouldPreserveConsumedExhaustedLatch({
        reason: "missao_esgotada:m-1",
        status: "PENDING",
      }),
    ).toBe(false);
    expect(
      shouldPreserveConsumedExhaustedLatch({
        reason: "backlog",
        status: "CONSUMED",
      }),
    ).toBe(false);
  });
});
