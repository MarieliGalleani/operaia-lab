import { describe, expect, it } from "vitest";
import { analyzeSales, type SaleInput } from "./business-analysis.js";

function sale(date: string, customer: string, product: string, revenue: number, cost: number | null = revenue * 0.6): SaleInput {
  return { date, customer, product, revenue, cost };
}

/** Datas a partir de um dia base, para montar series sem erro de calendario. */
function day(offset: number): string {
  const d = new Date(Date.UTC(2026, 0, 1) + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe("analyzeSales", () => {
  it("sem vendas: estado vazio, sem números inventados", () => {
    const a = analyzeSales([]);
    expect(a.empty).toBe(true);
    expect(a.kpis.marginPct).toBeNull();
    expect(a.insights).toEqual([]);
    expect(a.priority).toBeNull();
  });

  it("calcula receita, custo, lucro, margem, ticket e período", () => {
    const a = analyzeSales([
      sale("2026-01-10", "A", "X", 1000, 600),
      sale("2026-01-20", "B", "Y", 500, 250),
    ]);
    expect(a.period).toEqual({ from: "2026-01-10", to: "2026-01-20" });
    expect(a.kpis).toMatchObject({
      revenue: 1500,
      cost: 850,
      profit: 650,
      marginPct: 43.3,
      salesCount: 2,
      customersCount: 2,
      avgTicket: 750,
    });
  });

  it("sem coluna de custo: margem e lucro ficam null e o resumo avisa", () => {
    const a = analyzeSales([sale("2026-01-10", "A", "X", 100, null)]);
    expect(a.hasCost).toBe(false);
    expect(a.kpis.profit).toBeNull();
    expect(a.kpis.marginPct).toBeNull();
    expect(a.summary).toMatch(/custo/);
    expect(a.insights.some((i) => i.kind === "LOW_MARGIN_PRODUCT")).toBe(false);
  });

  it("agrupa por mês com rótulo em português", () => {
    const a = analyzeSales([sale("2026-01-10", "A", "X", 100), sale("2026-02-03", "A", "X", 200)]);
    expect(a.months.map((m) => [m.month, m.label, m.revenue])).toEqual([
      ["2026-01", "jan/26", 100],
      ["2026-02", "fev/26", 200],
    ]);
  });

  it("cliente em risco é medido pela última venda da planilha, não pelo relógio", () => {
    const sales: SaleInput[] = [];
    // A compra a cada 10 dias e para no dia 40; B continua ate o dia 120.
    for (let d = 0; d <= 40; d += 10) sales.push(sale(day(d), "Cliente A", "X", 500));
    for (let d = 0; d <= 120; d += 10) sales.push(sale(day(d), "Cliente B", "X", 100));
    const a = analyzeSales(sales);
    const risk = a.insights.filter((i) => i.kind === "CUSTOMER_AT_RISK");
    expect(risk.map((i) => i.title)).toEqual(["Cliente A parou de comprar"]);
    expect(risk[0]?.detail).toMatch(/80 dias/);
  });

  it("planilha antiga sem sumiço não gera alerta de risco", () => {
    const sales: SaleInput[] = [];
    for (let d = 0; d <= 60; d += 7) sales.push(sale(day(d), "A", "X", 100), sale(day(d), "B", "Y", 100));
    expect(analyzeSales(sales).insights.some((i) => i.kind === "CUSTOMER_AT_RISK")).toBe(false);
  });

  it("produto com prejuízo é crítico e vira a prioridade", () => {
    const a = analyzeSales([
      sale("2026-01-10", "A", "Bom", 1000, 500),
      sale("2026-01-11", "B", "Ruim", 400, 520),
    ]);
    expect(a.priority?.kind).toBe("NEGATIVE_MARGIN");
    expect(a.priority?.severity).toBe("CRITICAL");
    expect(a.priority?.impactBrl).toBe(120);
  });

  it("produto relevante com margem bem abaixo da média é sinalizado", () => {
    const a = analyzeSales([
      sale("2026-01-10", "A", "Premium", 1000, 400),
      sale("2026-01-11", "B", "Popular", 600, 540),
    ]);
    const low = a.insights.find((i) => i.kind === "LOW_MARGIN_PRODUCT");
    expect(low?.title).toBe("Popular tem margem baixa");
  });

  it("queda de receita nos últimos 30 dias gera alerta", () => {
    const sales: SaleInput[] = [];
    for (let d = 0; d < 60; d += 1) sales.push(sale(day(d), `C${d % 5}`, "X", d < 30 ? 200 : 100));
    const a = analyzeSales(sales);
    expect(a.kpis.revenueTrendPct).toBe(-50);
    expect(a.insights.find((i) => i.kind === "REVENUE_DROP")?.severity).toBe("CRITICAL");
  });

  it("com 4+ meses compara com a média dos 3 meses anteriores (pega queda que já tinha começado)", () => {
    const sales: SaleInput[] = [];
    for (let d = 0; d < 150; d += 1) sales.push(sale(day(d), `C${d % 5}`, "X", d < 100 ? 300 : 150));
    const a = analyzeSales(sales);
    expect(a.kpis.trendBasis).toBe("AVG_90");
    expect(a.kpis.last30Revenue).toBe(4500);
    expect(a.kpis.baselineRevenue).toBe(8000);
    expect(a.kpis.revenueTrendPct).toBeCloseTo(-43.75, 0);
    const drop = a.insights.find((i) => i.kind === "REVENUE_DROP");
    expect(drop?.severity).toBe("CRITICAL");
    expect(drop?.detail).toMatch(/média dos 3 meses anteriores/);
  });

  it("textos usam vírgula decimal", () => {
    const a = analyzeSales([sale("2026-01-10", "A", "X", 1000, 600), sale("2026-01-20", "B", "Y", 500, 250)]);
    expect(a.summary).toMatch(/margem de 43,3%/);
  });

  it("menos de 60 dias de dados: não compara períodos", () => {
    const a = analyzeSales([sale(day(0), "A", "X", 100), sale(day(20), "A", "X", 10)]);
    expect(a.kpis.revenueTrendPct).toBeNull();
  });

  it("dependência de um cliente só", () => {
    const a = analyzeSales([
      sale("2026-01-10", "Gigante", "X", 7000),
      sale("2026-01-10", "B", "X", 1000),
      sale("2026-01-10", "C", "X", 1000),
      sale("2026-01-10", "D", "X", 1000),
    ]);
    const c = a.insights.find((i) => i.kind === "CONCENTRATION");
    expect(c?.title).toMatch(/70%/);
    expect(c?.severity).toBe("HIGH");
  });

  it("saúde fica entre 0 e 100 e piora com problemas", () => {
    const healthy = analyzeSales([sale("2026-01-10", "A", "X", 1000, 500), sale("2026-01-10", "B", "X", 1000, 500), sale("2026-01-10", "C", "X", 1000, 500)]);
    const sick = analyzeSales([sale("2026-01-10", "A", "X", 1000, 1300), sale("2026-01-10", "B", "Y", 100, 150)]);
    expect(healthy.health.score).toBeGreaterThan(sick.health.score);
    expect(sick.health.score).toBeGreaterThanOrEqual(0);
    expect(healthy.health.score).toBeLessThanOrEqual(100);
    expect(sick.health.level).toBe("CRITICAL");
  });

  it("ranking de clientes com participação e dias sem comprar", () => {
    const a = analyzeSales([sale("2026-01-01", "A", "X", 300), sale("2026-01-31", "B", "X", 100)]);
    expect(a.topCustomers[0]).toMatchObject({ name: "A", sharePct: 75, daysSinceLastPurchase: 30 });
  });
});
