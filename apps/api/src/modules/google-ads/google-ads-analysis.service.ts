/**
 * Analise de conta (P1.X Fase 8) — mesma logica mostrada no video de
 * referencia: termos de pesquisa que gastaram dinheiro sem converter viram
 * candidatos a palavra negativa, e a fatia de impressao perdida mostra se o
 * problema e orcamento ou lance/qualidade.
 *
 * As funcoes de resumo (build.../summarize...) sao PURAS — recebem as linhas cruas
 * da API e nao fazem chamada de rede, entao dao pra testar sem conta real do
 * Google Ads. A orquestracao (runAnalysis) e que faz as chamadas reais.
 */
import { getConnectionOrThrow, markSyncError, markSyncSuccess } from "./google-ads-connection.service.js";
import { getCustomerClient } from "./google-ads-client.js";

const SEARCH_TERMS_QUERY = `
  SELECT
    search_term_view.search_term,
    campaign.id,
    campaign.name,
    metrics.cost_micros,
    metrics.clicks,
    metrics.conversions
  FROM search_term_view
  WHERE segments.date DURING LAST_30_DAYS
    AND metrics.clicks > 0
  ORDER BY metrics.cost_micros DESC
  LIMIT 200
`;

const LOST_IMPRESSION_SHARE_QUERY = `
  SELECT
    campaign.id,
    campaign.name,
    metrics.search_impression_share,
    metrics.search_budget_lost_impression_share,
    metrics.search_rank_lost_impression_share
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND campaign.status = 'ENABLED'
`;

const ACCOUNT_SUMMARY_QUERY = `
  SELECT
    metrics.cost_micros,
    metrics.conversions,
    metrics.clicks,
    metrics.impressions
  FROM customer
  WHERE segments.date DURING LAST_30_DAYS
`;

export interface SearchTermRow {
  search_term_view?: { search_term?: string | null } | null;
  campaign?: { id?: string | number | null; name?: string | null } | null;
  metrics?: { cost_micros?: string | number | null; clicks?: string | number | null; conversions?: number | null } | null;
}

export interface NegativeKeywordRecommendation {
  readonly term: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly costBrl: number;
  readonly clicks: number;
  readonly reason: string;
}

/** Mesmo criterio do video: gastou >= minCostBrl, zero conversao = candidato a negativar. */
export function buildNegativeKeywordRecommendations(
  rows: readonly SearchTermRow[],
  minCostBrl = 10,
): readonly NegativeKeywordRecommendation[] {
  return rows
    .map((row) => ({
      term: row.search_term_view?.search_term ?? "",
      campaignId: String(row.campaign?.id ?? ""),
      campaignName: row.campaign?.name ?? "",
      costBrl: Number(row.metrics?.cost_micros ?? 0) / 1_000_000,
      clicks: Number(row.metrics?.clicks ?? 0),
      conversions: Number(row.metrics?.conversions ?? 0),
    }))
    .filter((row) => row.conversions === 0 && row.costBrl >= minCostBrl && row.term.length > 0)
    .map((row) => ({
      term: row.term,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      costBrl: row.costBrl,
      clicks: row.clicks,
      reason: `Gastou R$ ${row.costBrl.toFixed(2)} em ${row.clicks} clique${row.clicks === 1 ? "" : "s"} sem nenhuma conversão.`,
    }))
    .sort((a, b) => b.costBrl - a.costBrl);
}

export interface LostImpressionShareRow {
  campaign?: { id?: string | number | null; name?: string | null } | null;
  metrics?: {
    search_impression_share?: number | null;
    search_budget_lost_impression_share?: number | null;
    search_rank_lost_impression_share?: number | null;
  } | null;
}

export interface LostImpressionShareInsight {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly impressionSharePct: number;
  readonly lostToBudgetPct: number;
  readonly lostToRankPct: number;
  readonly mainCause: "orcamento" | "lance_ou_qualidade" | "sem_perda_relevante";
}

/** >5% de perda vira sinal — compara se pesa mais pro lado de orcamento ou de lance/qualidade
 * (mesma leitura do video: "antes perdia por orcamento, aumentamos e reduziu"). */
export function summarizeLostImpressionShare(
  rows: readonly LostImpressionShareRow[],
): readonly LostImpressionShareInsight[] {
  const THRESHOLD_PCT = 5;
  return rows.map((row) => {
    const impressionSharePct = (row.metrics?.search_impression_share ?? 0) * 100;
    const lostToBudgetPct = (row.metrics?.search_budget_lost_impression_share ?? 0) * 100;
    const lostToRankPct = (row.metrics?.search_rank_lost_impression_share ?? 0) * 100;
    let mainCause: LostImpressionShareInsight["mainCause"] = "sem_perda_relevante";
    if (lostToBudgetPct > THRESHOLD_PCT || lostToRankPct > THRESHOLD_PCT) {
      mainCause = lostToBudgetPct >= lostToRankPct ? "orcamento" : "lance_ou_qualidade";
    }
    return {
      campaignId: String(row.campaign?.id ?? ""),
      campaignName: row.campaign?.name ?? "",
      impressionSharePct,
      lostToBudgetPct,
      lostToRankPct,
      mainCause,
    };
  });
}

export interface AccountSummaryRow {
  metrics?: {
    cost_micros?: string | number | null;
    conversions?: number | null;
    clicks?: string | number | null;
    impressions?: string | number | null;
  } | null;
}

export interface AccountSummary {
  readonly costBrl: number;
  readonly conversions: number;
  readonly clicks: number;
  readonly impressions: number;
  readonly costPerConversionBrl: number | null;
}

export function summarizeAccount(rows: readonly AccountSummaryRow[]): AccountSummary {
  const row = rows[0];
  const costBrl = Number(row?.metrics?.cost_micros ?? 0) / 1_000_000;
  const conversions = Number(row?.metrics?.conversions ?? 0);
  const clicks = Number(row?.metrics?.clicks ?? 0);
  const impressions = Number(row?.metrics?.impressions ?? 0);
  return {
    costBrl,
    conversions,
    clicks,
    impressions,
    costPerConversionBrl: conversions > 0 ? costBrl / conversions : null,
  };
}

export interface GoogleAdsAnalysis {
  readonly summary: AccountSummary;
  readonly negativeKeywordRecommendations: readonly NegativeKeywordRecommendation[];
  readonly lostImpressionShare: readonly LostImpressionShareInsight[];
}

/**
 * Consulta a conta real via API e monta a analise completa. NAO tem como
 * testar isto contra uma conta real ainda (sem credencial configurada) —
 * as queries GAQL seguem o schema documentado publicamente do Google Ads,
 * mas so serao validadas de fato quando houver uma conta conectada.
 */
export async function runAnalysis(clientId: string): Promise<GoogleAdsAnalysis> {
  const connection = await getConnectionOrThrow(clientId);
  const customer = getCustomerClient(connection);
  try {
    const [searchTermRows, lostIsRows, summaryRows] = await Promise.all([
      customer.query<SearchTermRow[]>(SEARCH_TERMS_QUERY),
      customer.query<LostImpressionShareRow[]>(LOST_IMPRESSION_SHARE_QUERY),
      customer.query<AccountSummaryRow[]>(ACCOUNT_SUMMARY_QUERY),
    ]);
    await markSyncSuccess(clientId);
    return {
      summary: summarizeAccount(summaryRows),
      negativeKeywordRecommendations: buildNegativeKeywordRecommendations(searchTermRows),
      lostImpressionShare: summarizeLostImpressionShare(lostIsRows),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao consultar Google Ads.";
    await markSyncError(clientId, message);
    throw error;
  }
}

/** Aplica uma palavra negativa direto na campanha — o "so verifico o que ele fez"
 * do video: a recomendacao so vira mudanca real quando o humano aprova aqui. */
export async function applyNegativeKeyword(
  clientId: string,
  campaignId: string,
  term: string,
): Promise<void> {
  const connection = await getConnectionOrThrow(clientId);
  const customer = getCustomerClient(connection);
  const cleanCustomerId = connection.customerId.replace(/-/g, "");
  await customer.mutateResources([
    {
      entity: "campaign_criterion",
      operation: "create",
      resource: {
        campaign: `customers/${cleanCustomerId}/campaigns/${campaignId}`,
        negative: true,
        keyword: { text: term, match_type: "BROAD" },
      },
    },
  ]);
}
