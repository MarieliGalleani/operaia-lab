import { describe, expect, it } from "vitest";
import {
  buildNegativeKeywordRecommendations,
  summarizeAccount,
  summarizeLostImpressionShare,
} from "./google-ads-analysis.service.js";

describe("buildNegativeKeywordRecommendations", () => {
  it("recomenda termo que gastou acima do minimo e teve zero conversao", () => {
    const rows = [
      {
        search_term_view: { search_term: "farmacia veterinaria" },
        campaign: { id: 1, name: "Busca - Geral" },
        metrics: { cost_micros: 17_000_000, clicks: 5, conversions: 0 },
      },
    ];
    const result = buildNegativeKeywordRecommendations(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.term).toBe("farmacia veterinaria");
    expect(result[0]!.costBrl).toBeCloseTo(17);
    expect(result[0]!.reason).toContain("R$ 17.00");
    expect(result[0]!.reason).toContain("sem nenhuma conversão");
  });

  it("nao recomenda termo que converteu, mesmo gastando muito", () => {
    const rows = [
      {
        search_term_view: { search_term: "farmacia perto de mim" },
        campaign: { id: 1, name: "Busca - Geral" },
        metrics: { cost_micros: 50_000_000, clicks: 20, conversions: 3 },
      },
    ];
    expect(buildNegativeKeywordRecommendations(rows)).toHaveLength(0);
  });

  it("nao recomenda termo abaixo do gasto minimo mesmo sem conversao", () => {
    const rows = [
      {
        search_term_view: { search_term: "farmacia barata" },
        campaign: { id: 1, name: "Busca - Geral" },
        metrics: { cost_micros: 3_000_000, clicks: 1, conversions: 0 },
      },
    ];
    expect(buildNegativeKeywordRecommendations(rows, 10)).toHaveLength(0);
  });

  it("ordena por custo decrescente", () => {
    const rows = [
      {
        search_term_view: { search_term: "termo barato" },
        campaign: { id: 1, name: "C" },
        metrics: { cost_micros: 12_000_000, clicks: 2, conversions: 0 },
      },
      {
        search_term_view: { search_term: "termo caro" },
        campaign: { id: 1, name: "C" },
        metrics: { cost_micros: 40_000_000, clicks: 8, conversions: 0 },
      },
    ];
    const result = buildNegativeKeywordRecommendations(rows);
    expect(result[0]!.term).toBe("termo caro");
    expect(result[1]!.term).toBe("termo barato");
  });
});

describe("summarizeLostImpressionShare", () => {
  it("aponta orcamento como causa principal quando a perda por orcamento domina", () => {
    const rows = [
      {
        campaign: { id: 10, name: "Busca - Farmácia" },
        metrics: {
          search_impression_share: 0.6,
          search_budget_lost_impression_share: 0.3,
          search_rank_lost_impression_share: 0.02,
        },
      },
    ];
    const result = summarizeLostImpressionShare(rows);
    expect(result[0]!.mainCause).toBe("orcamento");
    expect(result[0]!.impressionSharePct).toBeCloseTo(60);
    expect(result[0]!.lostToBudgetPct).toBeCloseTo(30);
  });

  it("aponta lance/qualidade quando a perda por rank domina", () => {
    const rows = [
      {
        campaign: { id: 11, name: "Busca - Concorrentes" },
        metrics: {
          search_impression_share: 0.4,
          search_budget_lost_impression_share: 0.01,
          search_rank_lost_impression_share: 0.55,
        },
      },
    ];
    expect(summarizeLostImpressionShare(rows)[0]!.mainCause).toBe("lance_ou_qualidade");
  });

  it("nao aponta causa relevante quando as perdas sao pequenas", () => {
    const rows = [
      {
        campaign: { id: 12, name: "Busca - Marca" },
        metrics: {
          search_impression_share: 0.95,
          search_budget_lost_impression_share: 0.02,
          search_rank_lost_impression_share: 0.01,
        },
      },
    ];
    expect(summarizeLostImpressionShare(rows)[0]!.mainCause).toBe("sem_perda_relevante");
  });
});

describe("summarizeAccount", () => {
  it("calcula custo por conversao quando ha conversoes", () => {
    const rows = [{ metrics: { cost_micros: 100_000_000, conversions: 20, clicks: 300, impressions: 5000 } }];
    const summary = summarizeAccount(rows);
    expect(summary.costBrl).toBeCloseTo(100);
    expect(summary.costPerConversionBrl).toBeCloseTo(5);
  });

  it("custo por conversao fica null quando nao ha conversao (nao divide por zero)", () => {
    const rows = [{ metrics: { cost_micros: 50_000_000, conversions: 0, clicks: 100, impressions: 2000 } }];
    expect(summarizeAccount(rows).costPerConversionBrl).toBeNull();
  });

  it("lida com linha vazia sem lancar erro", () => {
    expect(summarizeAccount([])).toEqual({
      costBrl: 0,
      conversions: 0,
      clicks: 0,
      impressions: 0,
      costPerConversionBrl: null,
    });
  });
});
