import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import { ceoRegisteredEmployee } from "@operaia/agents";
import { magRegisteredEmployee } from "@operaia/cto-mag";
import { EmployeeRegistry, Specialization } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import {
  DelegationService,
  EmployeeMatcher,
  EmployeeRunner,
  type EmployeeContext,
} from "./index.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  async complete(_messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    return { content: "Resumo do funcionario.", model: "stub" };
  }
}

/** Monta o escritorio: registra CEO e CTO e liga a camada de ativacao. */
function office() {
  const llm = new StubLLM();
  const registry = new EmployeeRegistry()
    .register(ceoRegisteredEmployee)
    .register(magRegisteredEmployee);
  const runner = new EmployeeRunner();
  const matcher = new EmployeeMatcher(registry);
  const delegation = new DelegationService(matcher, runner, { llm });
  return { llm, registry, runner, matcher, delegation };
}

const nexoContext: EmployeeContext = {
  workspace: {
    workspaceId: "nexo",
    name: "NEXO",
    tasks: [
      { id: "t1", title: "Implementar autenticacao", status: TaskStatus.TODO, impact: 5, urgency: 5 },
      { id: "t2", title: "Sincronizar dados offline", status: TaskStatus.TODO, impact: 4, urgency: 3, dependsOn: ["t1"] },
      { id: "t3", title: "Escrever documentacao", status: TaskStatus.DONE },
    ],
  },
  objective: "Finalizar desenvolvimento da NEXO",
};

describe("Fluxo real: Usuario -> CEO -> Delegacao -> CTO -> Retorno", () => {
  it("CEO analisa o Workspace e identifica necessidade tecnica", async () => {
    const { registry, runner, llm } = office();
    const ceo = registry.require("operaia-ceo").create({ llm });

    const ceoResult = await runner.run(ceo, nexoContext);

    expect(ceoResult.employeeId).toBe("operaia-ceo");
    expect(ceoResult.briefing.project).toBe("NEXO");
    expect(ceoResult.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
  });

  it("Matcher encontra a CTO Mag para SOFTWARE_ENGINEERING", () => {
    const { matcher } = office();
    const match = matcher.match(Specialization.SOFTWARE_ENGINEERING);
    expect(match?.profile.id).toBe("cto-mag");
    expect(match?.profile.name).toBe("Mag");
  });

  it("fluxo completo CEO -> CTO: Mag recebe briefing e devolve plano tecnico", async () => {
    const { registry, runner, delegation, llm } = office();

    // 1. CEO trabalha no Workspace
    const ceo = registry.require("operaia-ceo").create({ llm });
    const ceoResult = await runner.run(ceo, nexoContext);

    // 2. CEO delegou engenharia
    const delegations = ceoResult.output.decision.delegations;
    expect(delegations).toHaveLength(1);

    // 3. Delegacao resolve e executa a CTO Mag
    const outcomes = await delegation.run(delegations, nexoContext);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.matched).toBe(true);
    expect(outcomes[0]?.employeeId).toBe("cto-mag");

    // 4. CEO recebe de volta um plano tecnico acionavel
    const magOutput = outcomes[0]?.result?.output;
    expect(magOutput?.report.plan.length).toBeGreaterThan(0);
    expect(magOutput?.report.nextActions.length).toBeGreaterThan(0);
    expect(magOutput?.quality.passed).toBe(true);
  });

  it("especialidade sem funcionario no quadro retorna matched=false", async () => {
    const { delegation } = office();
    const outcomes = await delegation.run(
      [{ specialization: Specialization.LEGAL, reason: "Preciso de juridico." }],
      nexoContext,
    );
    expect(outcomes[0]?.matched).toBe(false);
  });
});
