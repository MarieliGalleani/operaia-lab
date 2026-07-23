import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import { Specialization } from "@operaia/employee-framework";
import type { EmployeeContext } from "@operaia/employee-runtime";
import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { createDigitalOffice } from "./office-composition.js";

/**
 * Stub apenas para testes da Etapa 1. O caminho de produto receberá
 * o provider real na Etapa 5; aqui validamos a composição, não a LLM.
 */
class StubLLM implements LLMProvider {
  readonly name = "stub";
  async complete(_messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    return { content: "Resumo do funcionario.", model: "stub" };
  }
}

const nexoContext: EmployeeContext = {
  workspace: {
    workspaceId: "nexo",
    name: "NEXO",
    tasks: [
      {
        id: "t1",
        title: "Implementar autenticacao",
        status: TaskStatus.TODO,
        impact: 5,
        urgency: 5,
      },
      {
        id: "t2",
        title: "Sincronizar dados offline",
        status: TaskStatus.TODO,
        impact: 4,
        urgency: 3,
        dependsOn: ["t1"],
      },
      { id: "t3", title: "Escrever documentacao", status: TaskStatus.DONE },
    ],
  },
  objective: "Finalizar desenvolvimento da NEXO",
};

describe("Etapa 1 — Composition Root da equipe na API", () => {
  it("registra Opera (CEO) e Mag (CTO) no EmployeeRegistry", () => {
    const office = createDigitalOffice({ llm: new StubLLM() });

    expect(office.registry.require("operaia-ceo").profile.name).toBe(
      "OperaIA CEO",
    );
    expect(office.registry.require("cto-mag").profile.name).toBe("Mag");
    expect(office.registry.all()).toHaveLength(2);
  });

  it("Matcher resolve SOFTWARE_ENGINEERING para a Mag", () => {
    const { matcher } = createDigitalOffice({ llm: new StubLLM() });
    const match = matcher.match(Specialization.SOFTWARE_ENGINEERING);

    expect(match?.profile.id).toBe("cto-mag");
  });

  it("CEO analisa o workspace e emite delegacao tecnica", async () => {
    const { registry, runner, llm } = createDigitalOffice({
      llm: new StubLLM(),
    });
    const ceo = registry.require("operaia-ceo").create({ llm });

    const ceoResult = await runner.run(ceo, nexoContext);

    expect(ceoResult.employeeId).toBe("operaia-ceo");
    expect(ceoResult.briefing.project).toBe("NEXO");
    expect(ceoResult.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
  });

  it("fluxo completo via DelegationService: CEO → Mag → plano tecnico", async () => {
    const { registry, runner, delegation, llm } = createDigitalOffice({
      llm: new StubLLM(),
    });

    const ceo = registry.require("operaia-ceo").create({ llm });
    const ceoResult = await runner.run(ceo, nexoContext);
    const delegations = ceoResult.output.decision.delegations;
    expect(delegations).toHaveLength(1);

    const outcomes = await delegation.run(delegations, nexoContext);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.matched).toBe(true);
    expect(outcomes[0]?.employeeId).toBe("cto-mag");

    const magOutput = outcomes[0]?.result?.output;
    expect(magOutput?.report.plan.length).toBeGreaterThan(0);
    expect(magOutput?.report.nextActions.length).toBeGreaterThan(0);
    expect(magOutput?.quality.passed).toBe(true);
  });

  it("especialidade sem funcionario no quadro retorna matched=false", async () => {
    const { delegation } = createDigitalOffice({ llm: new StubLLM() });

    const outcomes = await delegation.run(
      [{ specialization: Specialization.LEGAL, reason: "Preciso de juridico." }],
      nexoContext,
    );

    expect(outcomes[0]?.matched).toBe(false);
  });
});
