import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import { Specialization } from "@operaia/employee-framework";
import type { EmployeeContext } from "@operaia/employee-runtime";
import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { MissionOrchestrator } from "./mission-orchestrator.js";
import { createDigitalOffice } from "./office-composition.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  public calls = 0;
  async complete(messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    this.calls += 1;
    const user = messages.find((message) => message.role === "user")?.content ?? "";
    const content = user.includes("Modo: consolidacao")
      ? "Consolidei o plano tecnico da Mag e priorizei a autenticacao."
      : "Vou analisar o workspace e delegar a implementacao.";
    return { content, model: "stub" };
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

describe("Etapa 2 — MissionOrchestrator (CEO → Mag → Review → Resposta)", () => {
  it("orquestra Opera → Mag → Opera; resposta final vem da consolidacao", async () => {
    const llm = new StubLLM();
    const office = createDigitalOffice({ llm });
    const orchestrator = new MissionOrchestrator(office);

    const result = await orchestrator.run("operaia-ceo", nexoContext);

    expect(result.employeeId).toBe("operaia-ceo");
    expect(result.initial.output.decision.delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.matched).toBe(true);
    expect(result.outcomes[0]?.employeeId).toBe("cto-mag");

    // Resposta ao usuario = final da Opera, nao o report bruto da Mag
    expect(result.final.employeeId).toBe("operaia-ceo");
    expect(result.final.output.decision.delegations).toHaveLength(0);
    expect(result.final.output.report.summary).toContain("Consolidei");
    expect(result.final.briefing.additional["delegationOutcomes"]).toBeDefined();

    // Mag trabalhou (1) + Opera inicial (1) + Opera consolidacao (1)
    expect(llm.calls).toBe(3);
  });

  it("sem pendencias: Opera responde direto, sem segundo ciclo", async () => {
    const llm = new StubLLM();
    const office = createDigitalOffice({ llm });
    const orchestrator = new MissionOrchestrator(office);

    const doneContext: EmployeeContext = {
      workspace: {
        workspaceId: "nexo",
        name: "NEXO",
        tasks: [{ id: "t1", title: "Tudo pronto", status: TaskStatus.DONE }],
      },
      objective: "Fechar a NEXO",
    };

    const result = await orchestrator.run("operaia-ceo", doneContext);

    expect(result.outcomes).toHaveLength(0);
    expect(result.final).toBe(result.initial);
    expect(result.final.employeeId).toBe("operaia-ceo");
    expect(llm.calls).toBe(1);
  });

  it("nao expoe o summary bruto da Mag como resposta final", async () => {
    const office = createDigitalOffice({ llm: new StubLLM() });
    const orchestrator = new MissionOrchestrator(office);

    const result = await orchestrator.run("operaia-ceo", nexoContext);
    const magSummary = result.outcomes[0]?.result?.output.report.summary ?? "";

    expect(magSummary.length).toBeGreaterThan(0);
    expect(result.final.output.report.summary).not.toBe(magSummary);
    expect(result.final.output.report.summary).toContain("Consolidei");
  });
});
