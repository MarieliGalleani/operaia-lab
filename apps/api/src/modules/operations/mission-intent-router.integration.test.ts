/**
 * Integração A.4.2 — Intent Router no ciclo operacional (sync).
 */
import { Specialization } from "@operaia/employee-framework";
import { IntentType, RoutedEmployeeId } from "@operaia/mission-router";
import { describe, expect, it } from "vitest";
import { createLabRuntime } from "./lab-runtime.js";

describe("OperationalMissionService × Mission Intent Router", () => {
  it("classifica TECH_IMPLEMENTATION → Mag antes da missão", () => {
    const lab = createLabRuntime({ deterministic: true });
    const intent = lab.operations.service.routeIntent(
      "Quero implementar autenticação",
      "nexo",
    );
    expect(intent.intentType).toBe(IntentType.TECH_IMPLEMENTATION);
    expect(intent.suggestedEmployee).toBe(RoutedEmployeeId.mag);
    expect(intent.workspaceId).toBe("nexo");
  });

  it("classifica OPERATIONAL_REVIEW → Opera", () => {
    const lab = createLabRuntime({ deterministic: true });
    const intent = lab.operations.service.routeIntent(
      "Como está a NEXO?",
      "nexo",
    );
    expect(intent.intentType).toBe(IntentType.OPERATIONAL_REVIEW);
    expect(intent.suggestedEmployee).toBe(RoutedEmployeeId.opera);

    const plural = lab.operations.service.routeIntent(
      "Como estão meus projetos?",
      "nexo",
    );
    expect(plural.intentType).toBe(IntentType.OPERATIONAL_REVIEW);
  });

  it("missão de autenticação ainda coordena via CEO e delega Mag", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: "Quero implementar autenticação.",
      employeeId: "operaia-ceo",
    });

    expect(run.objective).toBe("Quero implementar autenticação.");
    expect(run.mission.initial.employeeId).toBe("operaia-ceo");
    expect(
      run.mission.initial.output.decision.delegations[0]?.specialization,
    ).toBe(Specialization.SOFTWARE_ENGINEERING);
    expect(run.mission.outcomes.some((o) => o.employeeId === "cto-mag")).toBe(
      true,
    );
  });

  it("review operacional nao força Mag", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: "Como estão meus projetos?",
      employeeId: "operaia-ceo",
    });
    expect(run.mission.outcomes).toHaveLength(0);
    expect(run.mission.final).toBe(run.mission.initial);
  });
});
