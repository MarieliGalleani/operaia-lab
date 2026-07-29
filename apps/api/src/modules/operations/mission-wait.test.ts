import { describe, expect, it, vi } from "vitest";
import {
  MissionNotFoundDuringWaitError,
  MissionWaitTimeoutError,
  waitUntilTerminal,
  type MissionTerminalLookup,
  type MissionTerminalView,
} from "./mission-wait.js";

function sequenceLookup(
  steps: Array<MissionTerminalView | null>,
): MissionTerminalLookup {
  let i = 0;
  return {
    async get(id: string) {
      const next = steps[Math.min(i, steps.length - 1)] ?? null;
      i += 1;
      if (next && next.id !== id) {
        return { ...next, id };
      }
      return next;
    },
  };
}

describe("waitUntilTerminal", () => {
  it("retorna quando status e terminal", async () => {
    const lookup = sequenceLookup([
      { id: "m1", status: "QUEUED" },
      { id: "m1", status: "RUNNING" },
      { id: "m1", status: "COMPLETED" },
    ]);
    const sleep = vi.fn(async () => undefined);
    let t = 0;

    const result = await waitUntilTerminal(lookup, "m1", {
      timeoutMs: 10_000,
      pollIntervalMs: 10,
      sleep,
      now: () => {
        t += 1;
        return t;
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(sleep).toHaveBeenCalled();
  });

  it("aceita FAILED como terminal", async () => {
    const lookup = sequenceLookup([{ id: "m1", status: "FAILED" }]);
    const result = await waitUntilTerminal(lookup, "m1", {
      timeoutMs: 1000,
      sleep: async () => undefined,
      now: () => 0,
    });
    expect(result.status).toBe("FAILED");
  });

  it("lança timeout se nao terminal", async () => {
    const lookup = sequenceLookup([{ id: "m1", status: "QUEUED" }]);
    let now = 0;

    await expect(
      waitUntilTerminal(lookup, "m1", {
        timeoutMs: 50,
        pollIntervalMs: 10,
        sleep: async () => {
          now += 20;
        },
        now: () => now,
      }),
    ).rejects.toBeInstanceOf(MissionWaitTimeoutError);
  });

  it("lança se missao desaparecer", async () => {
    const lookup = sequenceLookup([null]);
    await expect(
      waitUntilTerminal(lookup, "gone", {
        timeoutMs: 1000,
        sleep: async () => undefined,
        now: () => 0,
      }),
    ).rejects.toBeInstanceOf(MissionNotFoundDuringWaitError);
  });
});
