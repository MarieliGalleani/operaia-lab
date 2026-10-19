import type { LLMCompletion, LLMProvider } from "@operaia/ai-core";
import { describe, expect, it } from "vitest";
import {
  learnFromResults,
  parseResultsCsv,
  runStoreFlow,
  type StoreFlowConfig,
  type ProductCandidate,
} from "./index.js";

const llm: LLMProvider = {
  name: "stub",
  async complete(): Promise<LLMCompletion> {
    return { content: "{}", model: "stub" };
  },
};

const product: ProductCandidate = {
  id: "p1",
  title: "Organizador de gaveta",
  url: "https://loja.example/p1",
  price: 49.9,
  commissionRate: 0.1,
  rating: 4.8,
  soldCount: 3200,
  category: "Casa",
};

const config: StoreFlowConfig = { niche: "casa", channels: ["instagram"] };

async function firstRun() {
  return runStoreFlow({ products: [product], config, llm, campaignId: "out26" });
}

describe("Aprendizado com resultados", () => {
  it("lê o relatório do portal (sub_id, cliques, pedidos, comissão)", () => {
    const rows = parseResultsCsv(
      ["Sub ID;Cliques;Pedidos;Comissão", "out26-p1-instagram-A;120;6;R$ 29,94", "outro;5;0;0"].join("\n"),
    );
    expect(rows).toEqual([
      { subId: "out26-p1-instagram-A", clicks: 120, orders: 6, commission: 29.94 },
      { subId: "outro", clicks: 5, orders: 0, commission: 0 },
    ]);
  });

  it("declara o ângulo e o horário vencedores quando há cliques suficientes", async () => {
    const run = await firstRun();
    const report = learnFromResults(run.drafts, [
      { subId: "out26-p1-instagram-A", clicks: 100, orders: 2, commission: 9.98 },
      { subId: "out26-p1-instagram-B", clicks: 100, orders: 6, commission: 29.94 },
      { subId: "de-outra-campanha", clicks: 10, orders: 1, commission: 4.99 },
    ]);
    expect(report.matchedDrafts).toBe(2);
    expect(report.unmatchedSubIds).toEqual(["de-outra-campanha"]);
    expect(report.bestAngle).toBe("dor-solucao"); // versão B venceu
    expect(report.bestTimes.instagram).toEqual(["19:30", "12:00"]);
    expect(report.totals.commission).toBe(39.92);
    expect(report.insights.join(" ")).toMatch(/Problema → solução/);
  });

  it("não tira conclusão com poucos cliques", async () => {
    const run = await firstRun();
    const report = learnFromResults(run.drafts, [
      { subId: "out26-p1-instagram-A", clicks: 8, orders: 0, commission: 0 },
      { subId: "out26-p1-instagram-B", clicks: 6, orders: 1, commission: 4.99 },
    ]);
    expect(report.bestAngle).toBeNull();
    expect(report.bestTimes).toEqual({});
    expect(report.insights.join(" ")).toMatch(/teste A\/B continua/);
  });

  it("a próxima rodada usa o vencedor como versão A e os horários aprendidos", async () => {
    const run = await runStoreFlow({
      products: [product],
      config,
      llm,
      learning: { bestAngle: "dor-solucao", bestTimes: { instagram: ["20:30"] } },
    });
    const [a, b] = run.drafts;
    expect(a?.angle).toBe("dor-solucao");
    expect(b?.angle).toBe("prova-social");
    expect([a?.suggestedTime, b?.suggestedTime]).toEqual(["20:30", "20:30"]);
  });
});
