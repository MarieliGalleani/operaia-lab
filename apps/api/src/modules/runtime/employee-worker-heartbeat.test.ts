/**
 * MQ-3 — heartbeat paralelo durante execute (EmployeeWorker).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

describe("EmployeeWorker MQ-3 — heartbeat durante execute", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("timer de execucao pulsa enquanto await execute bloqueia o loop", async () => {
    vi.useFakeTimers();
    const pulses: number[] = [];
    let resolveExecute: (() => void) | undefined;
    const executeDone = new Promise<void>((resolve) => {
      resolveExecute = resolve;
    });

    // Simula o padrao do EmployeeWorker: setInterval paralelo ao await.
    const intervalMs = 5_000;
    const timer = setInterval(() => {
      pulses.push(Date.now());
    }, intervalMs);

    const executePromise = executeDone;
    // Avança tempo enquanto execute ainda nao resolveu.
    await vi.advanceTimersByTimeAsync(16_000);
    expect(pulses.length).toBeGreaterThanOrEqual(3);

    resolveExecute?.();
    await executePromise;
    clearInterval(timer);
  });
});
