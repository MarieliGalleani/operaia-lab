/**
 * A.5.1 — Sala CEO / ConversationMissionRouter.
 */
import { Specialization } from "@operaia/employee-framework";
import { IntentType, RoutedEmployeeId } from "@operaia/mission-router";
import { describe, expect, it } from "vitest";
import { createLabRuntime } from "./lab-runtime.js";

describe("Conversational Entry Routing (A.5.1)", () => {
  it("mensagem da sala CEO passa pelo ConversationMissionRouter", () => {
    const lab = createLabRuntime({ deterministic: true });
    const routed = lab.operations.service.routeConversation({
      message: "quais projetos temos?",
      workspaceId: "nexo",
      employeeId: "operaia-ceo",
      source: "ceo-sala",
    });
    expect(routed.intentType).toBe(IntentType.GENERAL_CONVERSATION);
    expect(routed.employeeId).toBe(RoutedEmployeeId.opera);
    expect(routed.objective).toContain("[MISSION_INTENT]");
    expect(routed.metadata.source).toBe("ceo-sala");
  });

  it("GENERAL_CONVERSATION nao gera operational summary", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: "quais projetos temos?",
      employeeId: "operaia-ceo",
      source: "ceo-sala",
    });

    expect(run.usableResult.toLowerCase()).not.toContain("analisei");
    expect(run.usableResult.toLowerCase()).not.toContain("merece atencao");
    expect(run.mission.outcomes).toHaveLength(0);
    expect(run.mission.initial.output.decision.recommendations).toEqual([]);
    expect(run.usableResult.toLowerCase()).toContain("nexo");
  });

  it("OPERATIONAL_REVIEW gera analise operacional", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: "O que merece atenção hoje?",
      employeeId: "operaia-ceo",
      source: "ceo-sala",
    });

    expect(run.usableResult.toLowerCase()).toMatch(/analisei|pendencia/);
    expect(run.mission.outcomes).toHaveLength(0);
  });

  it("TECH_IMPLEMENTATION chega ao Mag", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const routed = lab.operations.service.routeConversation({
      message: "Quero implementar autenticação",
      workspaceId: "nexo",
      source: "ceo-sala",
    });
    expect(routed.intentType).toBe(IntentType.TECH_IMPLEMENTATION);
    expect(routed.employeeId).toBe(RoutedEmployeeId.mag);

    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: "Quero implementar autenticação.",
      employeeId: "operaia-ceo",
      source: "ceo-sala",
    });
    expect(
      run.mission.initial.output.decision.delegations[0]?.specialization,
    ).toBe(Specialization.SOFTWARE_ENGINEERING);
    expect(run.mission.outcomes.some((o) => o.employeeId === "cto-mag")).toBe(
      true,
    );
  });

  it("BUG_INVESTIGATION e INFRASTRUCTURE roteiam Mag / Atlas", () => {
    const lab = createLabRuntime({ deterministic: true });
    const bug = lab.operations.service.routeConversation({
      message: "Está dando erro no login",
      workspaceId: "nexo",
    });
    expect(bug.intentType).toBe(IntentType.BUG_INVESTIGATION);
    expect(bug.employeeId).toBe(RoutedEmployeeId.mag);

    const infra = lab.operations.service.routeConversation({
      message: "Verifique Docker",
      workspaceId: "operaia-lab",
    });
    expect(infra.intentType).toBe(IntentType.INFRASTRUCTURE_OPERATION);
    expect(infra.employeeId).toBe(RoutedEmployeeId.atlas);

    const logs = lab.operations.service.routeConversation({
      message: "Analise logs do serviço",
      workspaceId: "operaia-lab",
    });
    expect(logs.employeeId).toBe(RoutedEmployeeId.orion);
  });

  it("ask da sala CEO preserva workspaceId e usa router", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const { reply, missionId, workflow } = await lab.team.ask({
      employeeId: "operaia-ceo",
      workspaceId: "nexo",
      question: "quais projetos temos?",
    });
    expect(missionId.length).toBeGreaterThan(0);
    expect(reply.content.toLowerCase()).not.toContain("analisei");
    expect(workflow.workspaceId).toBe("nexo");
  });
});
