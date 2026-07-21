import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import {
  BriefingBuilder,
  Specialization,
  type EmployeeBriefing,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { createCto, magProfile } from "./index.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  public lastMessages: readonly LLMMessage[] = [];
  constructor(private readonly content = "Analise tecnica da Mag.") {}
  async complete(messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    this.lastMessages = messages;
    return { content: this.content, model: "stub" };
  }
}

function briefing(
  tasks: EmployeeBriefing["tasks"],
  objective = "Finalizar desenvolvimento da NEXO",
): EmployeeBriefing {
  return new BriefingBuilder().build(
    { workspaceId: "nexo", name: "NEXO", tasks },
    objective,
  );
}

describe("CTO Mag (perfil)", () => {
  it("expoe o perfil no contrato comum com specialization SOFTWARE_ENGINEERING", () => {
    expect(magProfile.id).toBe("cto-mag");
    expect(magProfile.role).toBe("CTO");
    expect(magProfile.specialization).toBe(Specialization.SOFTWARE_ENGINEERING);
    expect(magProfile.limits).toContain("nao toma decisoes comerciais");
  });
});

describe("CTO Mag (brain)", () => {
  it("recebe briefing tecnico e entrega plano, riscos e proximas acoes", async () => {
    const llm = new StubLLM("Arquitetura ok; falta finalizar auth e sync.");
    const mag = createCto(llm);

    const output = await mag.work({
      briefing: briefing([
        { id: "t1", title: "Implementar autenticacao", status: TaskStatus.TODO },
        { id: "t2", title: "Sincronizar dados", status: TaskStatus.TODO, dependsOn: ["t1"] },
      ]),
    });

    expect(output.report.summary).toBe("Arquitetura ok; falta finalizar auth e sync.");
    expect(output.report.plan.length).toBeGreaterThan(0);
    expect(output.report.nextActions.length).toBeGreaterThan(0);
    expect(output.quality.passed).toBe(true);
    // tarefa sem dependencia vem antes na ordem de implementacao
    expect(output.report.nextActions[0]).toContain("Implementar autenticacao");
    // usa o LLMProvider com o system prompt da Mag
    expect(llm.lastMessages[0]?.content).toContain("CTO");
  });

  it("identifica risco em tarefas bloqueadas e dependencias", async () => {
    const mag = createCto(new StubLLM());
    const output = await mag.work({
      briefing: briefing([
        { id: "t1", title: "Migracao de banco", status: TaskStatus.BLOCKED },
        { id: "t2", title: "API de relatorios", status: TaskStatus.TODO, dependsOn: ["t1"] },
      ]),
    });

    expect(output.report.risks.join(" ")).toContain("Migracao de banco");
    expect(output.report.risks.join(" ")).toContain("depende de");
  });

  it("nao delega (mantem-se no escopo tecnico)", async () => {
    const mag = createCto(new StubLLM());
    const output = await mag.work({
      briefing: briefing([
        { id: "t1", title: "Refatorar modulo", status: TaskStatus.TODO },
      ]),
    });
    expect(output.decision.delegations).toHaveLength(0);
  });
});
