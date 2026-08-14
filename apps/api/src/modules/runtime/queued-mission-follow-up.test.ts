/**
 * P0 — gate/idempotencia do producer de follow-up tecnico.
 */
import { describe, expect, it } from "vitest";
import {
  buildTechnicalFollowUpObjective,
  FOLLOW_UP_DELEGATE_MARKER,
  shouldEnqueueTechnicalFollowUp,
} from "./queued-mission-executor.js";
import { hashObjective } from "./mission-queue.js";

function delivery(
  overrides: Partial<{
    type: "technical_analysis" | "priority_recommendation";
    status: "DELIVERED" | "FAILED";
    findings: string[];
    evidence: { source: string; data: Record<string, unknown> }[];
  }> = {},
) {
  return {
    type: overrides.type ?? ("technical_analysis" as const),
    status: overrides.status ?? ("DELIVERED" as const),
    missionId: "exec-a",
    employeeId: "cto-mag",
    objective: "Analise",
    summary: "Repo TypeScript",
    findings: overrides.findings ?? ["Raiz com monorepo"],
    evidence: overrides.evidence ?? [
      { source: "listDirectory", data: { entryCount: 11 } },
    ],
    recommendations: ["Revisar acoplamento"],
    deliveredAt: "2026-08-13T00:00:00.000Z",
  };
}

describe("P0 technical follow-up producer", () => {
  it("objective contem SOURCE_EXECUTE + FOLLOW_UP_DELEGATE e e estavel", () => {
    const a = buildTechnicalFollowUpObjective("exec-a");
    const b = buildTechnicalFollowUpObjective("exec-a");
    expect(a).toContain("[SOURCE_EXECUTE:exec-a]");
    expect(a).toContain(FOLLOW_UP_DELEGATE_MARKER);
    expect(a).toBe(b);
    expect(hashObjective("nexo", a)).toBe(hashObjective("nexo", b));
  });

  it("technical_analysis + DELIVERED gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        parentCoordinateObjective: "[COORDINATE/backlog] nexo",
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(true);
  });

  it("workspace hash difere entre workspaces (mesmo objective)", () => {
    const objective = buildTechnicalFollowUpObjective("exec-a");
    expect(hashObjective("nexo", objective)).not.toBe(
      hashObjective("outro", objective),
    );
  });

  it("segunda tentativa do mesmo source nao duplica", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        sourceAlreadyEmittedFollowUp: true,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: true,
      }),
    ).toBe(false);
  });

  it("sem technical_analysis nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery({ type: "priority_recommendation" }),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("sem DELIVERED nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery({ status: "FAILED" }),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("FAILED / sem delivery nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: undefined,
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("GENERAL_CONVERSATION no parent nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        parentCoordinateObjective:
          "[MISSION_INTENT] GENERAL_CONVERSATION|employee:operaia-ceo",
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("limite de profundidade: parent ja FOLLOW_UP_DELEGATE bloqueia", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        parentCoordinateObjective: buildTechnicalFollowUpObjective("exec-a"),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("sem evidence ou findings nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery({ evidence: [], findings: ["x"] }),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery({ findings: [], evidence: [{ source: "t", data: {} }] }),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });
});
