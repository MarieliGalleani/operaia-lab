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

function okToolContext(overrides?: {
  readonly failRepo?: boolean;
  readonly failList?: boolean;
  readonly skipListCapability?: boolean;
}) {
  let repoCalls = 0;
  let listCalls = 0;
  return {
    calls: () => ({ repoCalls, listCalls }),
    toolContext: {
      canUse(toolId: string) {
        if (toolId === "readRepository") {
          return true;
        }
        if (toolId === "listDirectory") {
          return !overrides?.skipListCapability;
        }
        return false;
      },
      async readRepository() {
        repoCalls += 1;
        if (overrides?.failRepo) {
          return {
            ok: false as const,
            error: { code: "GITHUB_ERROR", message: "repo down" },
          };
        }
        return {
          ok: true as const,
          data: {
            repository: "marieligalleani/operaia-lab",
            owner: "marieligalleani",
            name: "operaia-lab",
            defaultBranch: "lab",
            description: "lab",
            primaryLanguage: "TypeScript",
            updatedAt: "2026-08-12T00:00:00.000Z",
          },
        };
      },
      async listDirectory() {
        listCalls += 1;
        if (overrides?.failList) {
          return {
            ok: false as const,
            error: { code: "GITHUB_ERROR", message: "tree down" },
          };
        }
        return {
          ok: true as const,
          data: {
            repository: "marieligalleani/operaia-lab",
            path: ".",
            entries: [
              {
                name: "package.json",
                path: "package.json",
                type: "file",
                size: 100,
              },
              {
                name: "apps",
                path: "apps",
                type: "dir",
                size: null,
              },
            ],
          },
        };
      },
    },
  };
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
    expect(output.report.nextActions[0]).toContain("Implementar autenticacao");
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

  it("invoca readRepository + listDirectory e cria delivery DELIVERED", async () => {
    const stub = okToolContext();
    const mag = createCto(new StubLLM("Repo inspecionado; plano tecnico ok."));
    const base = briefing(
      [{ id: "t1", title: "Implementar autenticacao", status: TaskStatus.TODO }],
      "Analise o estado atual do repositorio",
    );
    const output = await mag.work({
      briefing: {
        ...base,
        additional: {
          ...base.additional,
          toolContext: stub.toolContext,
          toolIds: ["readRepository", "listDirectory"],
        },
      },
    });

    expect(stub.calls()).toEqual({ repoCalls: 1, listCalls: 1 });
    expect(output.decision.toolExecutions).toHaveLength(2);
    expect(output.decision.toolExecutions?.map((t) => t.toolId)).toEqual([
      "readRepository",
      "listDirectory",
    ]);
    expect(output.decision.delivery?.status).toBe("DELIVERED");
    expect(output.decision.delivery?.type).toBe("technical_analysis");
    expect(output.decision.delivery?.employeeId).toBe("cto-mag");
    expect(output.decision.delivery?.evidence).toHaveLength(2);
    expect(output.decision.delivery?.evidence[0]?.data.repository).toBe(
      "marieligalleani/operaia-lab",
    );
    expect(output.decision.delivery?.evidence[1]?.data.entryCount).toBe(2);
    expect(output.decision.analyzed).toContain("readRepository=ok");
    expect(output.decision.analyzed).toContain("listDirectory=ok");
  });

  it("nao marca DELIVERED quando listDirectory falha", async () => {
    const stub = okToolContext({ failList: true });
    const mag = createCto(new StubLLM("Falha parcial."));
    const base = briefing([
      { id: "t1", title: "Implementar autenticacao", status: TaskStatus.TODO },
    ]);
    const output = await mag.work({
      briefing: {
        ...base,
        additional: {
          ...base.additional,
          toolContext: stub.toolContext,
          toolIds: ["readRepository", "listDirectory"],
        },
      },
    });

    expect(stub.calls().repoCalls).toBe(1);
    expect(stub.calls().listCalls).toBe(1);
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(
      output.decision.toolExecutions?.find((t) => t.toolId === "listDirectory")
        ?.success,
    ).toBe(false);
    expect(output.decision.delivery?.evidence[1]?.data.error).toBe(
      "GITHUB_ERROR",
    );
  });

  it("nao marca DELIVERED quando readRepository falha", async () => {
    const stub = okToolContext({ failRepo: true });
    const mag = createCto(new StubLLM("Falha no repo."));
    const base = briefing([
      { id: "t1", title: "Implementar autenticacao", status: TaskStatus.TODO },
    ]);
    const output = await mag.work({
      briefing: {
        ...base,
        additional: {
          ...base.additional,
          toolContext: stub.toolContext,
          toolIds: ["readRepository", "listDirectory"],
        },
      },
    });

    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(
      output.decision.toolExecutions?.find((t) => t.toolId === "readRepository")
        ?.success,
    ).toBe(false);
  });
});
