/**
 * Andar 05 · Negócio — análise das vendas (função pura, sem banco).
 *
 * Tudo é calculado em relação à ÚLTIMA venda da planilha (`asOf`), não ao
 * relógio: uma planilha do ano passado não pode marcar todo mundo como
 * "cliente em risco" só porque o arquivo é antigo.
 *
 * Nenhum número é inventado: sem coluna de custo não há margem nem lucro, e a
 * tela mostra "—" em vez de zero.
 */

export interface SaleInput {
  /** aaaa-mm-dd */
  readonly date: string;
  readonly customer: string;
  readonly product: string;
  readonly revenue: number;
  readonly cost: number | null;
}

export type InsightKind =
  | "REVENUE_DROP"
  | "REVENUE_GROWTH"
  | "CUSTOMER_AT_RISK"
  | "NEGATIVE_MARGIN"
  | "LOW_MARGIN_PRODUCT"
  | "CONCENTRATION"
  | "GROWING_CUSTOMER";

export type InsightSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type InsightCategory = "RISK" | "PROBLEM" | "OPPORTUNITY";

export interface BusinessInsight {
  readonly key: string;
  readonly kind: InsightKind;
  readonly category: InsightCategory;
  readonly severity: InsightSeverity;
  readonly title: string;
  readonly detail: string;
  readonly action: string;
  /** Valor em jogo (R$) — o que se perde ou se ganha. null quando não dá para estimar. */
  readonly impactBrl: number | null;
  readonly impactLabel: string | null;
}

export interface BusinessKpis {
  readonly revenue: number;
  readonly cost: number | null;
  readonly profit: number | null;
  readonly marginPct: number | null;
  readonly salesCount: number;
  readonly customersCount: number;
  readonly productsCount: number;
  readonly avgTicket: number;
  /**
   * Receita dos últimos 30 dias vs a base de comparação (%). null sem base.
   * Base = média dos 3 blocos de 30 dias anteriores (com 120+ dias de dados)
   * ou os 30 dias anteriores (com 60 a 119 dias).
   */
  readonly revenueTrendPct: number | null;
  readonly last30Revenue: number;
  readonly baselineRevenue: number;
  readonly trendBasis: "AVG_90" | "PREV_30" | null;
}

export interface MonthPoint {
  /** aaaa-mm */
  readonly month: string;
  readonly label: string;
  readonly revenue: number;
  readonly profit: number | null;
  readonly sales: number;
}

export interface RankedCustomer {
  readonly name: string;
  readonly revenue: number;
  readonly sharePct: number;
  readonly sales: number;
  readonly lastPurchase: string;
  readonly daysSinceLastPurchase: number;
}

export interface RankedProduct {
  readonly name: string;
  readonly revenue: number;
  readonly sharePct: number;
  readonly sales: number;
  readonly marginPct: number | null;
}

export type HealthLevel = "EXCELLENT" | "GOOD" | "ATTENTION" | "CRITICAL";

export interface BusinessHealth {
  readonly score: number;
  readonly level: HealthLevel;
  readonly label: string;
}

export interface BusinessAnalysis {
  readonly empty: boolean;
  readonly period: { readonly from: string; readonly to: string } | null;
  readonly hasCost: boolean;
  readonly kpis: BusinessKpis;
  readonly health: BusinessHealth;
  readonly summary: string;
  readonly priority: BusinessInsight | null;
  readonly insights: readonly BusinessInsight[];
  readonly months: readonly MonthPoint[];
  readonly topCustomers: readonly RankedCustomer[];
  readonly topProducts: readonly RankedProduct[];
}

const DAY_MS = 86_400_000;
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

const SEVERITY_WEIGHT: Readonly<Record<InsightSeverity, number>> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function toDay(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Número em português (vírgula decimal). */
export function fmtNum(value: number, digits: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function basisText(kpis: BusinessKpis): string {
  return kpis.trendBasis === "AVG_90" ? "em relação à média dos 3 meses anteriores" : "em relação aos 30 dias anteriores";
}

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function sum(list: readonly SaleInput[], pick: (s: SaleInput) => number): number {
  let total = 0;
  for (const s of list) total += pick(s);
  return total;
}

function marginOf(list: readonly SaleInput[]): number | null {
  const withCost = list.filter((s) => s.cost !== null);
  if (withCost.length === 0) return null;
  const revenue = sum(withCost, (s) => s.revenue);
  if (revenue <= 0) return null;
  const cost = sum(withCost, (s) => s.cost ?? 0);
  return ((revenue - cost) / revenue) * 100;
}

function groupBy(list: readonly SaleInput[], key: (s: SaleInput) => string): Map<string, SaleInput[]> {
  const map = new Map<string, SaleInput[]>();
  for (const s of list) {
    const k = key(s);
    const bucket = map.get(k);
    if (bucket) bucket.push(s);
    else map.set(k, [s]);
  }
  return map;
}

function revenueBetween(list: readonly SaleInput[], fromDay: number, toDayExclusive: number): number {
  let total = 0;
  for (const s of list) {
    const d = toDay(s.date);
    if (d >= fromDay && d < toDayExclusive) total += s.revenue;
  }
  return total;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

const EMPTY_KPIS: BusinessKpis = {
  revenue: 0,
  cost: null,
  profit: null,
  marginPct: null,
  salesCount: 0,
  customersCount: 0,
  productsCount: 0,
  avgTicket: 0,
  revenueTrendPct: null,
  last30Revenue: 0,
  baselineRevenue: 0,
  trendBasis: null,
};

export function analyzeSales(sales: readonly SaleInput[]): BusinessAnalysis {
  if (sales.length === 0) {
    return {
      empty: true,
      period: null,
      hasCost: false,
      kpis: EMPTY_KPIS,
      health: { score: 0, level: "ATTENTION", label: "Sem dados" },
      summary: "Envie a primeira planilha de vendas para o andar começar a analisar.",
      priority: null,
      insights: [],
      months: [],
      topCustomers: [],
      topProducts: [],
    };
  }

  const sorted = [...sales].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const from = sorted[0]!.date;
  const to = sorted[sorted.length - 1]!.date;
  const asOf = toDay(to);
  const hasCost = sales.some((s) => s.cost !== null);

  const revenue = sum(sales, (s) => s.revenue);
  const marginPct = marginOf(sales);
  const cost = hasCost ? sum(sales, (s) => s.cost ?? 0) : null;
  const profit = cost === null ? null : revenue - cost;

  const byCustomer = groupBy(sales, (s) => s.customer);
  const byProduct = groupBy(sales, (s) => s.product);

  const last30 = revenueBetween(sales, asOf - 29 * DAY_MS, asOf + DAY_MS);
  const spanDays = (asOf - toDay(from)) / DAY_MS;
  // Comparar so com os 30 dias anteriores esconde uma queda que ja tinha
  // acontecido antes deles; a media de 90 dias mostra o patamar de antes.
  let trendBasis: BusinessKpis["trendBasis"] = null;
  let baseline = 0;
  if (spanDays >= 119) {
    trendBasis = "AVG_90";
    baseline = revenueBetween(sales, asOf - 119 * DAY_MS, asOf - 29 * DAY_MS) / 3;
  } else if (spanDays >= 59) {
    trendBasis = "PREV_30";
    baseline = revenueBetween(sales, asOf - 59 * DAY_MS, asOf - 29 * DAY_MS);
  }
  const revenueTrendPct = trendBasis ? pctChange(last30, baseline) : null;

  const kpis: BusinessKpis = {
    revenue: round2(revenue),
    cost: cost === null ? null : round2(cost),
    profit: profit === null ? null : round2(profit),
    marginPct: marginPct === null ? null : round1(marginPct),
    salesCount: sales.length,
    customersCount: byCustomer.size,
    productsCount: byProduct.size,
    avgTicket: round2(revenue / sales.length),
    revenueTrendPct: revenueTrendPct === null ? null : round1(revenueTrendPct),
    last30Revenue: round2(last30),
    baselineRevenue: round2(baseline),
    trendBasis,
  };

  const topCustomers: RankedCustomer[] = [...byCustomer.entries()]
    .map(([name, list]) => {
      const r = sum(list, (s) => s.revenue);
      const last = list.reduce((acc, s) => (s.date > acc ? s.date : acc), list[0]!.date);
      return {
        name,
        revenue: round2(r),
        sharePct: revenue > 0 ? round1((r / revenue) * 100) : 0,
        sales: list.length,
        lastPurchase: last,
        daysSinceLastPurchase: Math.round((asOf - toDay(last)) / DAY_MS),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const topProducts: RankedProduct[] = [...byProduct.entries()]
    .map(([name, list]) => {
      const r = sum(list, (s) => s.revenue);
      const m = marginOf(list);
      return {
        name,
        revenue: round2(r),
        sharePct: revenue > 0 ? round1((r / revenue) * 100) : 0,
        sales: list.length,
        marginPct: m === null ? null : round1(m),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const months = buildMonths(sales);

  const insights = [
    ...revenueTrendInsights(kpis),
    ...customerRiskInsights(byCustomer, asOf, topCustomers),
    ...marginInsights(byProduct, marginPct, revenue),
    ...concentrationInsights(topCustomers),
    ...growingCustomerInsights(byCustomer, asOf, spanDays),
  ].sort(
    (a, b) =>
      SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || (b.impactBrl ?? 0) - (a.impactBrl ?? 0),
  );

  const health = scoreHealth(kpis, insights);
  const summary = buildSummary(kpis, insights);

  return {
    empty: false,
    period: { from, to },
    hasCost,
    kpis,
    health,
    summary,
    priority: insights.find((i) => i.category !== "OPPORTUNITY") ?? insights[0] ?? null,
    insights,
    months,
    topCustomers: topCustomers.slice(0, 8),
    topProducts: topProducts.slice(0, 8),
  };
}

function buildMonths(sales: readonly SaleInput[]): MonthPoint[] {
  const byMonth = groupBy(sales, (s) => s.date.slice(0, 7));
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, list]) => {
      const m = marginOf(list);
      const r = sum(list, (s) => s.revenue);
      const withCost = list.filter((s) => s.cost !== null);
      return {
        month,
        label: `${MONTHS_PT[Number(month.slice(5, 7)) - 1]}/${month.slice(2, 4)}`,
        revenue: round2(r),
        profit: m === null ? null : round2(sum(withCost, (s) => s.revenue - (s.cost ?? 0))),
        sales: list.length,
      };
    });
}

function revenueTrendInsights(kpis: BusinessKpis): BusinessInsight[] {
  const t = kpis.revenueTrendPct;
  if (t === null) return [];
  if (t <= -15) {
    const lost = kpis.baselineRevenue - kpis.last30Revenue;
    return [
      {
        key: "revenue-drop",
        kind: "REVENUE_DROP",
        category: "RISK",
        severity: t <= -30 ? "CRITICAL" : "HIGH",
        title: `Receita caiu ${fmtNum(Math.abs(t), 0)}% nos últimos 30 dias`,
        detail: `Foram ${formatBrl(kpis.last30Revenue)} contra ${formatBrl(kpis.baselineRevenue)} ${basisText(kpis)}.`,
        action: "Ver em Maiores clientes quem está há mais dias sem comprar e falar primeiro com os maiores.",
        impactBrl: round2(lost),
        impactLabel: `${formatBrl(lost)} a menos em 30 dias`,
      },
    ];
  }
  if (t >= 20) {
    const gained = kpis.last30Revenue - kpis.baselineRevenue;
    return [
      {
        key: "revenue-growth",
        kind: "REVENUE_GROWTH",
        category: "OPPORTUNITY",
        severity: "LOW",
        title: `Receita subiu ${fmtNum(t, 0)}% nos últimos 30 dias`,
        detail: `Foram ${formatBrl(kpis.last30Revenue)} contra ${formatBrl(kpis.baselineRevenue)} ${basisText(kpis)}.`,
        action: "Descobrir o que puxou o crescimento e repetir (cliente, produto ou canal).",
        impactBrl: round2(gained),
        impactLabel: `${formatBrl(gained)} a mais em 30 dias`,
      },
    ];
  }
  return [];
}

function customerRiskInsights(
  byCustomer: Map<string, SaleInput[]>,
  asOf: number,
  ranked: readonly RankedCustomer[],
): BusinessInsight[] {
  const top5 = new Set(ranked.slice(0, 5).map((c) => c.name));
  const out: BusinessInsight[] = [];
  for (const [name, list] of byCustomer) {
    const days = [...new Set(list.map((s) => toDay(s.date)))].sort((a, b) => a - b);
    if (days.length < 2) continue;
    const first = days[0]!;
    const last = days[days.length - 1]!;
    const avgGap = (last - first) / DAY_MS / (days.length - 1);
    const silence = (asOf - last) / DAY_MS;
    const limit = Math.max(30, avgGap * 2);
    if (silence <= limit) continue;
    const months = Math.max(1, (last - first) / DAY_MS / 30);
    const monthly = sum(list, (s) => s.revenue) / months;
    const important = top5.has(name);
    out.push({
      key: `customer-at-risk:${slug(name)}`,
      kind: "CUSTOMER_AT_RISK",
      category: "RISK",
      severity: important ? "HIGH" : "MEDIUM",
      title: `${name} parou de comprar`,
      detail:
        `Comprava a cada ${Math.round(avgGap)} dia(s) em média e está há ${Math.round(silence)} dias sem comprar` +
        (important ? " — é um dos 5 maiores clientes." : "."),
      action: "Ligar ou mandar mensagem para entender o motivo e oferecer uma condição de retorno.",
      impactBrl: round2(monthly),
      impactLabel: `≈ ${formatBrl(monthly)}/mês em risco`,
    });
  }
  return out;
}

function marginInsights(
  byProduct: Map<string, SaleInput[]>,
  overallMargin: number | null,
  totalRevenue: number,
): BusinessInsight[] {
  if (overallMargin === null) return [];
  const out: BusinessInsight[] = [];
  for (const [name, list] of byProduct) {
    const m = marginOf(list);
    if (m === null) continue;
    const r = sum(list, (s) => s.revenue);
    if (m < 0) {
      const loss = sum(list, (s) => (s.cost ?? 0) - s.revenue);
      out.push({
        key: `negative-margin:${slug(name)}`,
        kind: "NEGATIVE_MARGIN",
        category: "PROBLEM",
        severity: "CRITICAL",
        title: `${name} é vendido com prejuízo`,
        detail: `Margem de ${fmtNum(m, 1)}%: o custo é maior que o preço de venda.`,
        action: "Revisar o preço ou o custo deste produto antes de vender mais.",
        impactBrl: round2(loss),
        impactLabel: `${formatBrl(loss)} de prejuízo no período`,
      });
      continue;
    }
    const gap = overallMargin - m;
    if (gap < 5 || r < totalRevenue * 0.05) continue;
    const lost = (gap / 100) * r;
    out.push({
      key: `low-margin:${slug(name)}`,
      kind: "LOW_MARGIN_PRODUCT",
      category: "PROBLEM",
      severity: gap >= 15 ? "HIGH" : "MEDIUM",
      title: `${name} tem margem baixa`,
      detail: `Margem de ${fmtNum(m, 1)}%, abaixo da média do negócio (${fmtNum(overallMargin, 1)}%). Representa ${fmtNum((r / totalRevenue) * 100, 0)}% da receita.`,
      action: "Revisar preço, desconto ou custo de compra deste produto.",
      impactBrl: round2(lost),
      impactLabel: `${formatBrl(lost)} de margem deixada na mesa`,
    });
  }
  return out;
}

function concentrationInsights(ranked: readonly RankedCustomer[]): BusinessInsight[] {
  const top = ranked[0];
  if (!top || ranked.length < 3 || top.sharePct < 30) return [];
  return [
    {
      key: `concentration:${slug(top.name)}`,
      kind: "CONCENTRATION",
      category: "RISK",
      severity: top.sharePct >= 50 ? "HIGH" : "MEDIUM",
      title: `${fmtNum(top.sharePct, 0)}% da receita vem de um cliente só`,
      detail: `${top.name} sozinho responde por ${formatBrl(top.revenue)}. Se ele sair, o caixa sente na hora.`,
      action: "Buscar novos clientes do mesmo perfil para diminuir a dependência.",
      impactBrl: top.revenue,
      impactLabel: `${formatBrl(top.revenue)} dependem de 1 cliente`,
    },
  ];
}

function growingCustomerInsights(
  byCustomer: Map<string, SaleInput[]>,
  asOf: number,
  spanDays: number,
): BusinessInsight[] {
  if (spanDays < 120) return [];
  const out: BusinessInsight[] = [];
  for (const [name, list] of byCustomer) {
    const recent = revenueBetween(list, asOf - 89 * DAY_MS, asOf + DAY_MS);
    const before = revenueBetween(list, asOf - 179 * DAY_MS, asOf - 89 * DAY_MS);
    const change = pctChange(recent, before);
    if (change === null || change < 50 || recent - before < 500) continue;
    const upside = recent * 0.15;
    out.push({
      key: `growing-customer:${slug(name)}`,
      kind: "GROWING_CUSTOMER",
      category: "OPPORTUNITY",
      severity: "LOW",
      title: `${name} está comprando mais`,
      detail: `Comprou ${fmtNum(change, 0)}% a mais nos últimos 90 dias (${formatBrl(recent)} contra ${formatBrl(before)}).`,
      action: "Oferecer mais volume, um pacote ou outro produto enquanto ele está crescendo.",
      impactBrl: round2(upside),
      impactLabel: `≈ ${formatBrl(upside)} de potencial extra`,
    });
  }
  return out.sort((a, b) => (b.impactBrl ?? 0) - (a.impactBrl ?? 0)).slice(0, 3);
}

export function scoreHealth(kpis: BusinessKpis, insights: readonly BusinessInsight[]): BusinessHealth {
  let score = 70;
  if (kpis.marginPct !== null) {
    if (kpis.marginPct >= 30) score += 14;
    else if (kpis.marginPct >= 20) score += 10;
    else if (kpis.marginPct >= 10) score += 4;
    else if (kpis.marginPct >= 0) score -= 8;
    else score -= 20;
  }
  if (kpis.revenueTrendPct !== null) {
    if (kpis.revenueTrendPct >= 10) score += 8;
    else if (kpis.revenueTrendPct <= -30) score -= 15;
    else if (kpis.revenueTrendPct <= -15) score -= 8;
  }
  for (const i of insights) {
    if (i.category === "OPPORTUNITY") score += 2;
    else if (i.severity === "CRITICAL") score -= 12;
    else if (i.severity === "HIGH") score -= 6;
    else if (i.severity === "MEDIUM") score -= 2;
  }
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const level: HealthLevel = s >= 85 ? "EXCELLENT" : s >= 70 ? "GOOD" : s >= 50 ? "ATTENTION" : "CRITICAL";
  const label = { EXCELLENT: "Excelente", GOOD: "Boa", ATTENTION: "Atenção", CRITICAL: "Crítica" }[level];
  return { score: s, level, label };
}

function buildSummary(kpis: BusinessKpis, insights: readonly BusinessInsight[]): string {
  const parts: string[] = [];
  parts.push(
    `${formatBrl(kpis.revenue)} em ${kpis.salesCount} venda(s) para ${kpis.customersCount} cliente(s)` +
      (kpis.marginPct !== null ? `, com margem de ${fmtNum(kpis.marginPct, 1)}%.` : "."),
  );
  if (kpis.revenueTrendPct !== null) {
    const t = kpis.revenueTrendPct;
    parts.push(
      Math.abs(t) < 5
        ? "Receita estável nos últimos 30 dias."
        : `Receita dos últimos 30 dias ${t > 0 ? "subiu" : "caiu"} ${fmtNum(Math.abs(t), 0)}% ${basisText(kpis)}.`,
    );
  }
  const risks = insights.filter((i) => i.category !== "OPPORTUNITY").length;
  const opps = insights.filter((i) => i.category === "OPPORTUNITY").length;
  if (risks === 0 && opps === 0) parts.push("Nenhum ponto de atenção encontrado.");
  else {
    const bits: string[] = [];
    if (risks) bits.push(`${risks} ponto(s) de atenção`);
    if (opps) bits.push(`${opps} oportunidade(s)`);
    parts.push(`${bits.join(" e ")}.`.replace(/^./, (c) => c.toUpperCase()));
  }
  if (kpis.marginPct === null) parts.push("Sem coluna de custo, não dá para calcular margem e lucro.");
  return parts.join(" ");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
