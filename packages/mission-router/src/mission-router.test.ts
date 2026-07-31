import { describe, expect, it } from "vitest";
import {
  IntentType,
  RuleBasedIntentRouter,
  RoutedEmployeeId,
  formatObjectiveWithIntent,
  requiresSpecialistFromIntentMarker,
} from "./index.js";

describe("RuleBasedIntentRouter", () => {
  const router = new RuleBasedIntentRouter();

  it("pergunta operacional vai para CEO (Opera)", () => {
    const a = router.route("Como está a NEXO?", "nexo");
    expect(a.intentType).toBe(IntentType.OPERATIONAL_REVIEW);
    expect(a.suggestedEmployee).toBe(RoutedEmployeeId.opera);
    expect(a.workspaceId).toBe("nexo");

    const b = router.route("O que merece atenção hoje?", "operaia-lab");
    expect(b.intentType).toBe(IntentType.OPERATIONAL_REVIEW);
    expect(b.suggestedEmployee).toBe(RoutedEmployeeId.opera);

    const c = router.route("Qual a saúde dos projetos?", "nexo");
    expect(c.intentType).toBe(IntentType.OPERATIONAL_REVIEW);
  });

  it("implementação técnica vai para Mag", () => {
    const intent = router.route("Quero implementar autenticação", "nexo");
    expect(intent.intentType).toBe(IntentType.TECH_IMPLEMENTATION);
    expect(intent.suggestedEmployee).toBe(RoutedEmployeeId.mag);
    expect(intent.message).toBe("Quero implementar autenticação");
    expect(intent.workspaceId).toBe("nexo");
    expect(intent.confidence).toBeGreaterThan(0.7);
  });

  it("bug vai para Mag", () => {
    const a = router.route("Está dando erro no login", "nexo");
    expect(a.intentType).toBe(IntentType.BUG_INVESTIGATION);
    expect(a.suggestedEmployee).toBe(RoutedEmployeeId.mag);

    const b = router.route("Falhou o deploy", "deploy");
    expect(b.intentType).toBe(IntentType.BUG_INVESTIGATION);

    const c = router.route("Por que isso quebrou?", "nexo");
    expect(c.intentType).toBe(IntentType.BUG_INVESTIGATION);
  });

  it("infraestrutura vai para Atlas (ou Orion em logs)", () => {
    const docker = router.route("Verifique Docker", "operaia-lab");
    expect(docker.intentType).toBe(IntentType.INFRASTRUCTURE_OPERATION);
    expect(docker.suggestedEmployee).toBe(RoutedEmployeeId.atlas);

    const server = router.route("Servidor está com problema", "infra");
    expect(server.intentType).toBe(IntentType.INFRASTRUCTURE_OPERATION);
    expect(server.suggestedEmployee).toBe(RoutedEmployeeId.atlas);

    const logs = router.route("Analise logs do serviço", "operaia-lab");
    expect(logs.intentType).toBe(IntentType.INFRASTRUCTURE_OPERATION);
    expect(logs.suggestedEmployee).toBe(RoutedEmployeeId.orion);
  });

  it("decisão estratégica e planejamento vão para CEO", () => {
    const decision = router.route(
      "Devemos seguir esse caminho?",
      "nexo",
    );
    expect(decision.intentType).toBe(IntentType.EXECUTIVE_DECISION);
    expect(decision.suggestedEmployee).toBe(RoutedEmployeeId.opera);

    const plan = router.route("Monte um roadmap para a entrega", "nexo");
    expect(plan.intentType).toBe(IntentType.PROJECT_PLANNING);
    expect(plan.suggestedEmployee).toBe(RoutedEmployeeId.opera);
  });

  it("mensagem desconhecida vai para CEO (GENERAL_CONVERSATION)", () => {
    const intent = router.route("Oi, tudo bem?", "nexo");
    expect(intent.intentType).toBe(IntentType.GENERAL_CONVERSATION);
    expect(intent.suggestedEmployee).toBe(RoutedEmployeeId.opera);
  });

  it("workspaceId preservado", () => {
    const intent = router.route("Preciso criar uma API", "flowgrid");
    expect(intent.workspaceId).toBe("flowgrid");
    expect(intent.intentType).toBe(IntentType.TECH_IMPLEMENTATION);
  });

  it("formatObjectiveWithIntent marca specialist intents", () => {
    const intent = router.route("Quero implementar autenticação", "nexo");
    const objective = formatObjectiveWithIntent(intent.message, intent);
    expect(requiresSpecialistFromIntentMarker(objective)).toBe(true);
    expect(objective).toContain("TECH_IMPLEMENTATION");
    expect(objective).toContain("cto-mag");
    expect(objective).toContain("Quero implementar autenticação");
  });
});
