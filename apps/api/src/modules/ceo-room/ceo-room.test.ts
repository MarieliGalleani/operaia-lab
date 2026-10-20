import { describe, expect, it } from "vitest";
import type { LLMProvider } from "@operaia/ai-core";
import { cleanError, cleanObjective, readDelivery, type CeoBriefing } from "./ceo-briefing.js";
import { buildOperaMessages, chatWithOpera, detectWorkspace, factualAnswer, looksLikeWork, parseOperaAnswer } from "./ceo-chat.js";

const briefing: CeoBriefing = {
  generatedAt: "2026-10-20T13:00:00.000Z",
  health: { level: "ok", label: "Operando", summary: "Tudo certo", workersAlive: 9, workersExpected: 9, queued: 0, running: 1, waiting: 0 },
  approvalsPending: [{ id: "a1", title: "Executar demanda: migrar banco", risk: "HIGH", workspaceId: "podiario", workspaceName: "Podiário", createdAt: "2026-10-20T12:00:00.000Z" }],
  running: [{ id: "m1", workspaceId: "podiario", workspaceName: "Podiário", objective: "Revisar agenda", human: true, at: "2026-10-20T12:59:00.000Z" }],
  queued: [],
  deliveries: [],
  failures: [{ id: "f1", workspaceId: "cardapio", workspaceName: "Cardápio", objective: "Build", human: false, at: "2026-10-20T11:00:00.000Z", error: "timeout" }],
  counts24h: { completed: 30, failed: 1, human: 3, automatic: 28 },
  floorRuns: [],
  storeFlow: { niche: "casa", pending: 4, approved: 1, rejected: 0, updatedAt: "2026-10-20T12:00:00.000Z" },
  projects: [{ workspaceId: "podiario", name: "Podiário", kind: "client", missions24h: 5, failures24h: 0 }],
};

describe("retrato da Opera", () => {
  it("limpa marcas internas do objetivo", () => {
    expect(cleanObjective("[HUMAN_DEMAND] Analisar README")).toBe("Analisar README");
    expect(cleanObjective("[MISSION_INTENT] OPERATIONAL_REVIEW|employee:opera")).toBe("Revisão operacional automática");
  });
  it("esconde segredos e corta erro", () => {
    expect(cleanError("falhou com sk-ant-abcdefghijklmnop\nstack...")).toBe("falhou com [oculto]");
    expect(cleanError(null)).toMatch(/sem mensagem/);
  });
  it("entrega em texto pronto conta como vazia", () => {
    expect(readDelivery({ delivery: { summary: "Analisei o workspace, priorizei as pendencias e preparei o plano" } })?.canned).toBe(true);
    const real = readDelivery({ delivery: { summary: "O README não explica o deploy.", findings: ["Falta seção de deploy"], recommendations: ["Adicionar passo a passo"] } });
    expect(real?.canned).toBe(false);
    expect(real?.recommendations).toEqual(["Adicionar passo a passo"]);
  });
});

describe("chat da Opera", () => {
  it("acha o projeto citado, mesmo sem acento", () => {
    expect(detectWorkspace("como está o podiario site?")?.id).toBe("podiario-site");
    expect(detectWorkspace("e o Podiário?")?.id).toBe("podiario");
    expect(detectWorkspace("bom dia")).toBeNull();
  });
  it("reconhece pedido de trabalho", () => {
    expect(looksLikeWork("Analise o README do Cardápio")).toBe(true);
    expect(looksLikeWork("o que tem pra hoje?")).toBe(false);
  });
  it("prompt leva o retrato real", () => {
    const msgs = buildOperaMessages({ message: "oi", history: [{ role: "user", text: "a" }, { role: "opera", text: "b" }], briefing });
    expect(msgs[0]!.content).toContain("migrar banco");
    expect(msgs[0]!.content).toContain("Cardápio");
    expect(msgs[0]!.content).toContain("4 posts esperando aprovação");
    expect(msgs.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
  });
  it("lê JSON da IA", () => {
    expect(parseOperaAnswer('```json\n{"resposta":"Oi","demanda":null}\n```')).toEqual({ resposta: "Oi", demanda: null });
    expect(parseOperaAnswer('x {"resposta":"Ok","demanda":{"workspaceId":"podiario","texto":"Revisar"}} y')?.demanda?.workspaceId).toBe("podiario");
  });
  it("sem IA responde com fatos e propõe demanda", () => {
    const f = factualAnswer("Corrija o build do Cardápio", briefing);
    expect(f.answer).toContain("1 aprovação");
    expect(f.answer).toContain("timeout");
    expect(f.demand?.workspaceId).toBe("cardapio");
  });
  it("IA no modo reserva cai na resposta factual", async () => {
    const llm: LLMProvider = { name: "x", complete: async () => ({ content: "texto pronto", model: "deterministic" }) } as LLMProvider;
    const r = await chatWithOpera({ llm, message: "o que tem hoje?", history: [], briefing });
    expect(r.usedAi).toBe(false);
    expect(r.answer).toContain("sem IA");
  });
  it("IA lenta demais: responde com fatos no limite", async () => {
    const llm: LLMProvider = { name: "x", complete: () => new Promise(() => {}) } as unknown as LLMProvider;
    const r = await chatWithOpera({ llm, message: "oi", history: [], briefing, timeoutMs: 20 });
    expect(r.usedAi).toBe(false);
  });
  it("IA real: demanda com projeto inválido é descartada", async () => {
    const llm: LLMProvider = { name: "x", complete: async () => ({ content: '{"resposta":"Feito","demanda":{"workspaceId":"projeto-que-nao-existe","texto":"x"}}', model: "gemini" }) } as LLMProvider;
    const r = await chatWithOpera({ llm, message: "faça x", history: [], briefing });
    expect(r.usedAi).toBe(true);
    expect(r.suggestedDemand).toBeNull();
  });
});
