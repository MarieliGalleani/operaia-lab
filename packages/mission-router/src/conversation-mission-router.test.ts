import { describe, expect, it } from "vitest";
import {
  ConversationMissionRouter,
  IntentType,
  RoutedEmployeeId,
} from "./index.js";

describe("ConversationMissionRouter (A.5.1)", () => {
  const router = new ConversationMissionRouter();

  it("Como está a NEXO? → OPERATIONAL_REVIEW / operaia-ceo", () => {
    const result = router.route({
      message: "Como está a NEXO?",
      workspaceId: "nexo",
      context: { source: "ceo-sala", employeeId: "operaia-ceo" },
    });
    expect(result.intentType).toBe(IntentType.OPERATIONAL_REVIEW);
    expect(result.employeeId).toBe(RoutedEmployeeId.opera);
    expect(result.missionType).toBe("COORDINATE");
    expect(result.objective).toContain("[MISSION_INTENT]");
    expect(result.metadata.workspaceId).toBe("nexo");
  });

  it("Quero implementar autenticação → TECH / Mag", () => {
    const result = router.route({
      message: "Quero implementar autenticação",
      workspaceId: "nexo",
      context: { source: "ceo-sala" },
    });
    expect(result.intentType).toBe(IntentType.TECH_IMPLEMENTATION);
    expect(result.employeeId).toBe(RoutedEmployeeId.mag);
    expect(result.missionType).toBe("SPECIALIST_COORDINATE");
  });

  it("Quais projetos temos? → GENERAL_CONVERSATION / Opera", () => {
    const result = router.route({
      message: "quais projetos temos?",
      workspaceId: "nexo",
      context: { source: "ceo-sala" },
    });
    expect(result.intentType).toBe(IntentType.GENERAL_CONVERSATION);
    expect(result.employeeId).toBe(RoutedEmployeeId.opera);
    expect(result.missionType).toBe("CONVERSATION");
    expect(result.objective).toContain("GENERAL_CONVERSATION");
  });

  it("preserva workspaceId", () => {
    const result = router.route({
      message: "Falhou o deploy",
      workspaceId: "deploy",
    });
    expect(result.metadata.workspaceId).toBe("deploy");
    expect(result.intentType).toBe(IntentType.BUG_INVESTIGATION);
    expect(result.employeeId).toBe(RoutedEmployeeId.mag);
  });
});
