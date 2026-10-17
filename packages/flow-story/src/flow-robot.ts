/**
 * Flow — Robô de Ofertas.
 *
 * Curadoria deterministica (sem LLM): o mesmo dado sempre gera a mesma
 * lista, e cada escolha vem com o motivo. Isso evita o robo "achar" uma nota
 * ou comissao que nao existe.
 */

import type { AffiliateLinkProvider } from "./affiliate-link.js";
import type {
  CuratedProduct,
  FlowStoryConfig,
  ProductCandidate,
  RejectedProduct,
  SalesSignal,
} from "./types.js";

export const FLOW_DEFAULTS = {
  minRating: 4.5,
  minStoreRating: 4.5,
  minCommissionRate: 0.05,
  minSoldCount: 50,
  maxProducts: 5,
  maxPerCategory: 2,
} as const;

/** Comissao por venda a partir da qual o criterio ja conta pontuacao cheia. */
const FULL_SCORE_COMMISSION_BRL = 20;
/** Vendas a partir das quais a prova social conta pontuacao cheia. */
const FULL_SCORE_SOLD = 10_000;

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function brl(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function percent(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(".", ",").replace(",0", "")}%`;
}

function isValidCandidate(p: ProductCandidate): string | null {
  if (!p.id || !p.title.trim()) return "dados incompletos (id ou titulo)";
  if (!/^https?:\/\//i.test(p.url)) return "URL invalida";
  if (!Number.isFinite(p.price) || p.price <= 0) return "preco invalido";
  if (!Number.isFinite(p.commissionRate) || p.commissionRate < 0 || p.commissionRate > 1) {
    return "comissao invalida";
  }
  if (!Number.isFinite(p.rating) || p.rating < 0 || p.rating > 5) return "nota invalida";
  return null;
}

/** Fracao das vendas totais que aconteceu nos ultimos 30 dias (0..1). */
export function momentumOf(p: ProductCandidate): number | null {
  if (p.soldLast30Days === undefined || p.soldCount <= 0) return null;
  return Math.min(Math.max(p.soldLast30Days / p.soldCount, 0), 1);
}

/** Desconto como fracao (0.3 = 30% off), ou null sem preco original valido. */
export function discountOf(p: ProductCandidate): number | null {
  if (p.originalPrice === undefined || p.originalPrice <= p.price) return null;
  return 1 - p.price / p.originalPrice;
}

/** Produto em alta: >= 20% de todas as vendas no ultimo mes e >= 100 vendas/mes. */
const HOT_MOMENTUM = 0.2;
const HOT_MIN_MONTHLY = 100;
const DISCOUNT_SIGNAL = 0.15;
const CHAMPION_SOLD = 5_000;
const TOP_STORE = 4.8;

export function signalsOf(p: ProductCandidate): SalesSignal[] {
  const signals: SalesSignal[] = [];
  const momentum = momentumOf(p);
  if (momentum !== null && momentum >= HOT_MOMENTUM && (p.soldLast30Days ?? 0) >= HOT_MIN_MONTHLY) {
    signals.push("em-alta");
  }
  const discount = discountOf(p);
  if (discount !== null && discount >= DISCOUNT_SIGNAL) signals.push("desconto");
  if (p.soldCount >= CHAMPION_SOLD) signals.push("campeao");
  if (p.storeRating !== undefined && p.storeRating >= TOP_STORE) signals.push("loja-top");
  return signals;
}

/**
 * Pontuacao 0..100 de "chance de virar venda com boa comissao":
 * comissao em R$ (35) + nota (20) + prova social (15) + em alta (12)
 * + loja (10) + desconto (8). Dado ausente vale metade (neutro).
 */
export function scoreProduct(p: ProductCandidate): number {
  const commission = p.price * p.commissionRate;
  const commissionPts = Math.min(commission / FULL_SCORE_COMMISSION_BRL, 1) * 35;
  const ratingPts = Math.max(0, (p.rating - 4) / 1) * 20;
  const soldPts =
    Math.min(Math.log10(Math.max(p.soldCount, 1)) / Math.log10(FULL_SCORE_SOLD), 1) * 15;
  const momentum = momentumOf(p);
  const momentumPts = momentum === null ? 6 : Math.min(momentum / 0.4, 1) * 12;
  const storePts =
    p.storeRating === undefined ? 5 : Math.max(0, (p.storeRating - 4) / 1) * 10;
  const discount = discountOf(p);
  const discountPts =
    p.originalPrice === undefined ? 4 : Math.min((discount ?? 0) / 0.4, 1) * 8;
  return Math.round(
    Math.min(commissionPts + ratingPts + soldPts + momentumPts + storePts + discountPts, 100),
  );
}

export interface FlowCurationResult {
  readonly curated: readonly CuratedProduct[];
  readonly rejected: readonly RejectedProduct[];
}

export class FlowRobot {
  constructor(private readonly links: AffiliateLinkProvider) {}

  async curate(
    candidates: readonly ProductCandidate[],
    config: FlowStoryConfig,
    campaignId = "flowstory",
  ): Promise<FlowCurationResult> {
    const minRating = config.minRating ?? FLOW_DEFAULTS.minRating;
    const minStore = config.minStoreRating ?? FLOW_DEFAULTS.minStoreRating;
    const minCommission = config.minCommissionRate ?? FLOW_DEFAULTS.minCommissionRate;
    const minSold = config.minSoldCount ?? FLOW_DEFAULTS.minSoldCount;
    const maxProducts = Math.max(1, config.maxProducts ?? FLOW_DEFAULTS.maxProducts);
    const allowedCategories = (config.categories ?? []).map(normalizeText);

    const rejected: RejectedProduct[] = [];
    const approved: ProductCandidate[] = [];
    const seen = new Set<string>();

    for (const p of candidates) {
      const reject = (reason: string) =>
        rejected.push({ productId: p.id, title: p.title, reason });

      const invalid = isValidCandidate(p);
      if (invalid) {
        reject(invalid);
        continue;
      }
      const key = normalizeText(p.url.split("?")[0] ?? p.url);
      if (seen.has(p.id) || seen.has(key)) {
        reject("produto repetido");
        continue;
      }
      seen.add(p.id);
      seen.add(key);

      if (
        allowedCategories.length > 0 &&
        !allowedCategories.includes(normalizeText(p.category))
      ) {
        reject(`fora do nicho (${p.category})`);
        continue;
      }
      if (p.rating < minRating) {
        reject(`nota ${p.rating} abaixo de ${minRating}`);
        continue;
      }
      if (p.storeRating !== undefined && p.storeRating < minStore) {
        reject(`loja com nota ${p.storeRating} abaixo de ${minStore}`);
        continue;
      }
      if (p.soldCount < minSold) {
        reject(`poucas vendas (${p.soldCount})`);
        continue;
      }
      if (p.commissionRate < minCommission) {
        reject(`comissao ${percent(p.commissionRate)} abaixo de ${percent(minCommission)}`);
        continue;
      }
      approved.push(p);
    }

    const ranked = approved
      .map((product) => ({ product, score: scoreProduct(product) }))
      .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));

    // Variedade: no maximo N por categoria, para o feed nao virar uma vitrine so.
    const maxPerCategory = Math.max(1, config.maxPerCategory ?? FLOW_DEFAULTS.maxPerCategory);
    const perCategory = new Map<string, number>();
    const picked: typeof ranked = [];
    for (const item of ranked) {
      const cat = normalizeText(item.product.category);
      const used = perCategory.get(cat) ?? 0;
      if (picked.length >= maxProducts) {
        rejected.push({
          productId: item.product.id,
          title: item.product.title,
          reason: `ficou fora do top ${maxProducts}`,
        });
        continue;
      }
      if (used >= maxPerCategory) {
        rejected.push({
          productId: item.product.id,
          title: item.product.title,
          reason: `categoria cheia (${item.product.category}, max ${maxPerCategory})`,
        });
        continue;
      }
      perCategory.set(cat, used + 1);
      picked.push(item);
    }

    const curated: CuratedProduct[] = [];
    for (const { product, score } of picked) {
      const estimatedCommission = Math.round(product.price * product.commissionRate * 100) / 100;
      const link = await this.links.createLink({
        productUrl: product.url,
        subId: `${campaignId}-${product.id}`,
      });
      curated.push({
        product,
        score,
        estimatedCommission,
        affiliateUrl: link.url,
        linkPending: link.pending,
        signals: signalsOf(product),
        reasons: [
          `comissao ${percent(product.commissionRate)} (≈ ${brl(estimatedCommission)} por venda)`,
          `nota ${product.rating} com ${product.soldCount} vendidos`,
          ...(product.soldLast30Days !== undefined
            ? [`${product.soldLast30Days} vendidos nos ultimos 30 dias`]
            : []),
          ...(discountOf(product) !== null
            ? [`${percent(discountOf(product)!)} de desconto (de ${brl(product.originalPrice!)})`]
            : []),
          ...(product.storeRating !== undefined ? [`loja nota ${product.storeRating}`] : []),
        ],
      });
    }

    return { curated, rejected };
  }
}
