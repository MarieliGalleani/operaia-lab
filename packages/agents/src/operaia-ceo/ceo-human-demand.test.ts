import { describe, expect, it } from "vitest";
import { Specialization } from "@operaia/employee-framework";
import {
  HUMAN_DEMAND_MARKER,
  needsSpecialistDelegation,
  stripObjectiveMarkers,
} from "./ceo-delegation-gate.js";
import { buildStrategicPlan } from "./ceo-strategic-plan.js";

const demand = `${HUMAN_DEMAND_MARKER} Revisar o README do operaia-lab e listar 3 melhorias de clareza.`;

describe("Demanda humana (Nova demanda do 1º andar)", () => {
  it("vai para especialista mesmo sem pendencias no quadro", () => {
    expect(needsSpecialistDelegation({ objective: demand, pendingTitles: [], planRequestsDelegate: false })).toBe(true);
  });

  it("sem a marca, o comportamento antigo continua (Opera responde)", () => {
    expect(
      needsSpecialistDelegation({ objective: stripObjectiveMarkers(demand), pendingTitles: [], planRequestsDelegate: false }),
    ).toBe(false);
  });

  it("pergunta consultiva continua com a Opera", () => {
    expect(
      needsSpecialistDelegation({ objective: `${HUMAN_DEMAND_MARKER} Como estão os projetos?`, pendingTitles: [], planRequestsDelegate: false }),
    ).toBe(false);
  });

  it("o especialista recebe o pedido da usuaria como tarefa", () => {
    const plan = buildStrategicPlan({ objective: demand, pendingTitles: ["Tarefa antiga do quadro"] });
    expect(plan.delegations.length).toBeGreaterThan(0);
    expect(plan.delegations[0]!.task).toBe(`${HUMAN_DEMAND_MARKER} Revisar o README do operaia-lab e listar 3 melhorias de clareza.`);
  });

  it("escolhe o especialista pelo assunto do pedido", () => {
    const plan = buildStrategicPlan({ objective: `${HUMAN_DEMAND_MARKER} Melhorar a usabilidade da tela de login no Figma` });
    expect(plan.specializations).toContain(Specialization.PRODUCT_DESIGN);
  });
});
