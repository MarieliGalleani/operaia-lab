/**
 * P0.2H-POST.1A — MissionScanner: noise de FAILED exhausted CONSUMED.
 */
import { describe, expect, it } from "vitest";
import { InMemoryCoordinationLatchStore } from "./infrastructure/in-memory-coordination-latch-store.js";
import { MissionScanner } from "./mission-scanner.js";
import type { MissionQueuePort, MissionView } from "./ports.js";

const fixedNow = new Date("2026-08-24T12:00:00.000Z");
const clock = { now: () => fixedNow };

function mission(
  partial: Partial<MissionView> & { id: string },
): MissionView {
  return {
    workspaceId: "nexo",
    status: "FAILED",
    readiness: "READY",
    attempt: 3,
    maxAttempts: 3,
    updatedAt: fixedNow,
    startedAt: null,
    lastError: "Quota M1 excedida",
    missionKind: "EXECUTE",
    ownerEmployeeId: "cto-mag",
    ...partial,
  };
}

function queueOf(rows: readonly MissionView[]): MissionQueuePort {
  return {
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
        return [...rows];
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
      return 0;
    },
    async enqueue() {
      return { created: false, id: "" };
    },
  };
}

describe("MissionScanner — FAILED exhausted + latch", () => {
  it("A — exhausted + latch CONSUMED → needsCoordination=false", async () => {
    const latches = new InMemoryCoordinationLatchStore();
    const key = { workspaceId: "nexo", reason: "missao_esgotada:m-acked" };
    await latches.tryAcquire(key);
    await latches.complete(key, "coord-1");

    const report = await new MissionScanner(
      queueOf([mission({ id: "m-acked" })]),
      clock,
      30_000,
      latches,
    ).scan();
    const item = report.items.find((i) => i.missionId === "m-acked");

    expect(item?.category).toBe("FAILED");
    expect(item?.needsCoordination).toBe(false);
    expect(report.coordinationNeeded).toBe(0);
  });

  it("B — exhausted + latch PENDING/ausente → needsCoordination=true", async () => {
    const latches = new InMemoryCoordinationLatchStore();
    await latches.tryAcquire({
      workspaceId: "nexo",
      reason: "missao_esgotada:m-open",
    });

    const withPending = await new MissionScanner(
      queueOf([mission({ id: "m-open" })]),
      clock,
      30_000,
      latches,
    ).scan();
    expect(
      withPending.items.find((i) => i.missionId === "m-open")
        ?.needsCoordination,
    ).toBe(true);
    expect(withPending.coordinationNeeded).toBe(1);

    const absent = await new MissionScanner(
      queueOf([mission({ id: "m-absent" })]),
      clock,
      30_000,
      latches,
    ).scan();
    expect(
      absent.items.find((i) => i.missionId === "m-absent")?.needsCoordination,
    ).toBe(true);
    expect(absent.coordinationNeeded).toBe(1);
  });

  it("E — missoes nao-FAILED / retryable mantem comportamento anterior", async () => {
    const latches = new InMemoryCoordinationLatchStore();
    const rows = [
      mission({ id: "m-retry", attempt: 1, maxAttempts: 3 }),
      mission({
        id: "m-wait",
        status: "WAITING",
        attempt: 0,
        maxAttempts: 3,
      }),
      mission({
        id: "m-run",
        status: "RUNNING",
        attempt: 0,
        maxAttempts: 3,
      }),
    ];
    const report = await new MissionScanner(
      queueOf(rows),
      clock,
      30_000,
      latches,
    ).scan();

    expect(report.items.find((i) => i.missionId === "m-retry")?.category).toBe(
      "RETRY",
    );
    expect(
      report.items.find((i) => i.missionId === "m-retry")?.needsCoordination,
    ).toBe(false);
    expect(report.items.find((i) => i.missionId === "m-wait")?.category).toBe(
      "WAITING",
    );
    expect(
      report.items.find((i) => i.missionId === "m-wait")?.needsCoordination,
    ).toBe(true);
    expect(report.items.find((i) => i.missionId === "m-run")?.needsCoordination).toBe(
      false,
    );
  });
});
