import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it } from "vitest";
import {
  isBroadLaunchObjective,
  resolveAllRequiredSpecializations,
  resolveRequiredSpecialization,
} from "./ceo-specialization-resolver.js";
import { buildStrategicPlan } from "./ceo-strategic-plan.js";

describe("resolveRequiredSpecialization", () => {
  it("resolve por dominio sem nome de Employee", () => {
    expect(resolveRequiredSpecialization("Preciso de design UX no app")).toBe(
      Specialization.PRODUCT_DESIGN,
    );
    expect(resolveRequiredSpecialization("Revisar contrato juridico")).toBe(
      Specialization.LEGAL,
    );
    expect(resolveRequiredSpecialization("Planejar orçamento financeiro")).toBe(
      Specialization.FINANCE,
    );
    expect(resolveRequiredSpecialization("Automatizar workflow n8n")).toBe(
      Specialization.AUTOMATION,
    );
    expect(resolveRequiredSpecialization("Campanha de marketing")).toBe(
      Specialization.MARKETING,
    );
    expect(resolveRequiredSpecialization("Definir roadmap de produto")).toBe(
      Specialization.PRODUCT_MANAGEMENT,
    );
    expect(resolveRequiredSpecialization("Melhorar operação e SLA")).toBe(
      Specialization.OPERATIONS,
    );
    expect(resolveRequiredSpecialization("Implementar autenticacao")).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
  });

  it("default tecnico quando o objetivo e generico de execucao", () => {
    expect(resolveRequiredSpecialization("Avancar a NEXO")).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
  });

  it("usa titulos das pendencias quando o objetivo e generico", () => {
    expect(
      resolveRequiredSpecialization({
        objective: "trabalha em cima dessas duas pendencias",
        pendingTitles: [
          "Implementar autenticacao",
          "Sincronizar dados offline",
        ],
      }),
    ).toBe(Specialization.SOFTWARE_ENGINEERING);

    expect(
      resolveRequiredSpecialization({
        objective: "trabalha nas pendencias",
        pendingTitles: ["Revisar contrato juridico LGPD"],
      }),
    ).toBe(Specialization.LEGAL);
  });
});

describe("resolveAllRequiredSpecializations + strategic plan", () => {
  it("objetivo de lancamento gera multiplos dominios", () => {
    expect(isBroadLaunchObjective("Lancar o NEXO")).toBe(true);
    const specs = resolveAllRequiredSpecializations("Lancar o NEXO");
    expect(specs.length).toBeGreaterThanOrEqual(4);
    expect(specs).toContain(Specialization.SOFTWARE_ENGINEERING);
    expect(specs).toContain(Specialization.PRODUCT_DESIGN);
    expect(specs).toContain(Specialization.MARKETING);
    expect(specs).toContain(Specialization.LEGAL);
  });

  it("buildStrategicPlan cria delegacoes e edges", () => {
    const plan = buildStrategicPlan({
      objective: "Lancar o produto com UX, marketing e LGPD",
    });
    expect(plan.delegations.length).toBeGreaterThanOrEqual(3);
    expect(plan.edges.length).toBeGreaterThan(0);
  });

  it("respeita especializacoes saturadas na capacidade", () => {
    const plan = buildStrategicPlan({
      objective: "Lancar o NEXO",
      capacity: {
        saturatedSpecializations: [Specialization.MARKETING],
      },
    });
    expect(
      plan.specializations.includes(Specialization.MARKETING),
    ).toBe(false);
    expect(plan.delegations.length).toBeGreaterThan(0);
  });
});
