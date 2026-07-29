import { describe, expect, it } from "vitest";
import {
  hashObjective,
  resolveEnqueueContract,
} from "./mission-queue.js";
import { CEO_EMPLOYEE_ID, MissionKind, MissionQueueStatus } from "./mission-states.js";
import { WorkerMetrics } from "./runtime-metrics.js";

describe("runtime continuo — utilitarios", () => {
  it("hashObjective e estavel por workspace+objetivo", () => {
    const a = hashObjective("ws-1", "  Fazer X  ");
    const b = hashObjective("ws-1", "Fazer X");
    const c = hashObjective("ws-2", "Fazer X");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(32);
  });

  it("CEO_EMPLOYEE_ID e porta-voz fixo da composition", () => {
    expect(CEO_EMPLOYEE_ID).toBe("operaia-ceo");
  });

  it("estados minimos da fila existem", () => {
    expect(MissionQueueStatus.QUEUED).toBe("QUEUED");
    expect(MissionQueueStatus.RUNNING).toBe("RUNNING");
    expect(MissionQueueStatus.WAITING).toBe("WAITING");
    expect(MissionQueueStatus.COMPLETED).toBe("COMPLETED");
    expect(MissionQueueStatus.FAILED).toBe("FAILED");
  });

  it("resolveEnqueueContract forca Opera em COORDINATE (regressao Fase 1)", () => {
    const resolved = resolveEnqueueContract({
      workspaceId: "ws",
      objective: "obj",
      ownerEmployeeId: "outro",
    });
    expect(resolved.missionKind).toBe(MissionKind.COORDINATE);
    expect(resolved.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
  });

  it("WorkerMetrics agrega sucesso e falha", () => {
    const metrics = new WorkerMetrics();
    metrics.recordSuccess(100);
    metrics.recordFailure(50, true);
    const snap = metrics.snapshot();
    expect(snap.missionsCompleted).toBe(1);
    expect(snap.missionsFailed).toBe(1);
    expect(snap.retries).toBe(1);
    expect(metrics.averageDurationMs()).toBe(75);
  });
});
