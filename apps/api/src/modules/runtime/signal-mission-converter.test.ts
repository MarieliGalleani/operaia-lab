import { describe, expect, it, vi } from "vitest";
import type { DomainSignalRecord } from "@operaia/domain-signals";
import type { MissionQueue } from "./mission-queue.js";
import type { AlreadyDoneGate } from "./work-governance/index.js";
import {
  buildSignalCoordinateObjective,
  enqueueSignalCoordinateMission,
} from "./signal-mission-converter.js";

describe("buildSignalCoordinateObjective", () => {
  it("gera objective COORDINATE/SIGNAL com refs de auditoria", () => {
    const now = new Date();
    const signal = {
      id: "s1",
      workspaceId: "nexo",
      bindingId: null,
      sourceType: "github",
      sourceId: "pr:3",
      type: "github.pr.opened",
      deliveryId: "del-1",
      signalHash: "h",
      correlationId: "corr-1",
      status: "EVALUATED",
      payloadJson: {},
      metadataJson: null,
      evaluationDecision: "CONVERT_CANDIDATE",
      evaluationPolicy: "github-default@1",
      evaluationReason: "ok",
      evaluationJson: null,
      evaluatedAt: now,
      missionId: null,
      payloadVersion: 1,
      occurredAt: now,
      receivedAt: now,
      convertedAt: null,
      resolvedAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    } satisfies DomainSignalRecord;

    const objective = buildSignalCoordinateObjective(signal);
    expect(objective).toContain("[COORDINATE/SIGNAL]");
    expect(objective).toContain("github.pr.opened");
    expect(objective).toContain("workspace=nexo");
    expect(objective).toContain("pr:3");
    expect(objective).toContain("corr-1");
    expect(objective).toContain("motivo=");
  });
});

describe("enqueueSignalCoordinateMission — origin (P1.2B)", () => {
  it("enfileira com origin=SIGNAL_GITHUB", async () => {
    const now = new Date();
    const signal = {
      id: "s1",
      workspaceId: "nexo",
      bindingId: null,
      sourceType: "github",
      sourceId: "pr:3",
      type: "github.pr.opened",
      deliveryId: "del-1",
      signalHash: "h",
      correlationId: "corr-1",
      status: "EVALUATED",
      payloadJson: {},
      metadataJson: null,
      evaluationDecision: "CONVERT_CANDIDATE",
      evaluationPolicy: "github-default@1",
      evaluationReason: "ok",
      evaluationJson: null,
      evaluatedAt: now,
      missionId: null,
      payloadVersion: 1,
      occurredAt: now,
      receivedAt: now,
      convertedAt: null,
      resolvedAt: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    } satisfies DomainSignalRecord;

    const enqueue = vi.fn().mockResolvedValue({
      mission: { id: "mission-1" },
      created: true,
    });
    const queue = { enqueue } as unknown as MissionQueue;
    const gate = {
      admit: vi.fn().mockResolvedValue({ decision: "EXECUTE" }),
      bindExecute: vi.fn().mockResolvedValue(undefined),
    } as unknown as AlreadyDoneGate;

    const missionId = await enqueueSignalCoordinateMission({
      queue,
      signal,
      gate,
    });

    expect(missionId).toBe("mission-1");
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "SIGNAL_GITHUB" }),
    );
  });
});
