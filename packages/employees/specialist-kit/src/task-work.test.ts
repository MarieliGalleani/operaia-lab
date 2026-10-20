import { describe, expect, it } from "vitest";
import type { EmployeeBriefing } from "@operaia/employee-framework";
import { cleanRequest, extractRequestedFiles, parseAnswer, performRequestedWork } from "./task-work.js";

function briefing(objective: string, memory: string[] = []): EmployeeBriefing {
  return {
    project: "operaia-lab", objective, executiveSummary: "", currentState: "", pending: [], tasks: [],
    documentation: [], history: [], constraints: [], successCriteria: [], additional: { memoryContext: memory },
  };
}

describe("task-work — especialista faz o trabalho pedido", () => {
  it("acha os arquivos citados e entende README", () => {
    expect(extractRequestedFiles("Leia o README e o docs/roadmap.md")).toEqual(["docs/roadmap.md", "README.md"]);
    expect(extractRequestedFiles("revise apps/web/src/App.vue, por favor")).toEqual(["apps/web/src/App.vue"]);
    expect(extractRequestedFiles("melhore o onboarding")).toEqual([]);
  });

  it("limpa as marcas internas do pedido", () => {
    expect(cleanRequest("[HUMAN_DEMAND] Ler o README")).toBe("Ler o README");
  });

  it("le JSON puro, em bloco ou no meio do texto", () => {
    expect(parseAnswer('{"resumo":"ok","achados":["a"],"recomendacoes":["b"]}')?.achados).toEqual(["a"]);
    expect(parseAnswer('Segue:\n```json\n{"resumo":"ok2"}\n```')?.resumo).toBe("ok2");
    expect(parseAnswer("sem json aqui")).toBeNull();
  });

  it("le o arquivo pedido, usa a memoria e devolve a resposta do LLM", async () => {
    let prompt = "";
    const llm = {
      name: "fake",
      async complete(messages: readonly { content: string }[]) {
        prompt = messages[1]!.content;
        return { content: '{"resumo":"README claro, falta setup","achados":["Sem passo a passo"],"recomendacoes":["Adicionar Como rodar"]}', model: "fake" };
      },
    };
    const tools = {
      canUse: (id: string) => id === "readFile",
      async readFile({ path }: { path: string }) {
        return { ok: true as const, data: { path, content: "# OperaIA.lab\nEscritorio virtual.", encoding: "utf-8" } };
      },
    };
    const result = await performRequestedWork({
      llm, systemPrompt: "sys", domainLabel: "Engenharia", tools, priorEvidence: [],
      briefing: briefing("[HUMAN_DEMAND] Ler o README e sugerir melhorias", ["Licao: README desatualizado em setembro"]),
    });
    expect(result.filesRead).toEqual(["README.md"]);
    expect(result.memoryUsed).toBe(1);
    expect(result.summary).toBe("README claro, falta setup");
    expect(result.recommendations).toEqual(["Adicionar Como rodar"]);
    expect(prompt).toContain("Escritorio virtual.");
    expect(prompt).toContain("README desatualizado");
  });
});
