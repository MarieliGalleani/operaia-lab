import { describe, expect, it } from "vitest";
import { summarizeHarness } from "./autonomy-loop-harness.js";
import type { AutonomyLoopEvidence } from "./autonomy-loop-evidence.js";

function stage(
  id: AutonomyLoopEvidence["stages"][number]["stage"],
  present: boolean,
): AutonomyLoopEvidence["stages"][number] {
  return {
    stage: id,
    present,
    summary: present ? "ok" : "missing",
    details: {},
  };
}

describe("autonomy-loop-harness summarizeHarness", () => {
  it("PASS somente com 7/7 stages present", () => {
    const evidence: AutonomyLoopEvidence = {
      demandId: "d1",
      correlationId: "d1",
      missionId: "m1",
      demandStatus: "COMPLETED",
      gateDecision: "EXECUTE",
      loopEvidenceComplete: true,
      stages: [
        stage("intake", true),
        stage("planning", true),
        stage("delegation", true),
        stage("mission", true),
        stage("execution", true),
        stage("validation", true),
        stage("delivery", true),
      ],
    };
    const result = summarizeHarness(evidence);
    expect(result.ok).toBe(true);
    expect(result.missingStages).toEqual([]);
  });

  it("NÃO mascara ausência de validation/delivery como PASS", () => {
    const evidence: AutonomyLoopEvidence = {
      demandId: "d1",
      correlationId: "d1",
      missionId: "m1",
      demandStatus: "EXECUTING",
      gateDecision: "EXECUTE",
      loopEvidenceComplete: false,
      stages: [
        stage("intake", true),
        stage("planning", true),
        stage("delegation", true),
        stage("mission", true),
        stage("execution", true),
        stage("validation", false),
        stage("delivery", false),
      ],
    };
    const result = summarizeHarness(evidence);
    expect(result.ok).toBe(false);
    expect(result.missingStages).toEqual(["validation", "delivery"]);
  });

  it("correlationId === demandId", () => {
    const evidence: AutonomyLoopEvidence = {
      demandId: "demand-corr",
      correlationId: "demand-corr",
      missionId: null,
      demandStatus: "PLANNED",
      gateDecision: null,
      loopEvidenceComplete: false,
      stages: [
        stage("intake", true),
        stage("planning", true),
        stage("delegation", false),
        stage("mission", false),
        stage("execution", false),
        stage("validation", false),
        stage("delivery", false),
      ],
    };
    expect(evidence.correlationId).toBe(evidence.demandId);
    expect(summarizeHarness(evidence).ok).toBe(false);
  });
});
