import { describe, expect, it } from "vitest";
import type { DomainSignalRecord } from "@operaia/domain-signals";
import { buildSignalCoordinateObjective } from "./signal-mission-converter.js";

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
