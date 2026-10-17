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
} from "./types.js";

export const FLOW_DEFAULTS = {
  minRating: 4.5,
  minStoreRating: 4.5,
  minCommissionRate: 0.05,
  minSoldCount: 50,
  maxProducts: 5,
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

/** Pontuacao 0..100: comissao (40) + nota (25) + vendas (20) + loja (15). */
export function scoreProduct(p: ProductCandidate): number {
  const commission = p.price * p.commissionRate;
  const commissionPts = Math.min(commission / FULL_SCORE_COMMISSION_BRL, 1) * 40;
  const ratingPts = Math.max(0, (p.rating - 4) / 1) * 25;
  const soldPts =
    Math.min(Math.log10(Math.max(p.soldCount, 1)) / Math.log10(FULL_SCORE_SOLD), 1) * 20;
  const storePts =
    p.storeRating === undefined ? 7.5 : Math.max(0, (p.storeRating - 4) / 1) * 15;
  return Math.round(Math.min(commissionPts + ratingPts + soldPts + storePts, 100));
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

    for (const extra of ranked.slice(maxProducts)) {
      rejected.push({
        productId: extra.product.id,
        title: extra.product.title,
        reason: `ficou fora do top ${maxProducts}`,
      });
    }

    const curated: CuratedProduct[] = [];
    for (const { product, score } of ranked.slice(0, maxProducts)) {
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
        reasons: [
          `comissao ${percent(product.commissionRate)} (≈ ${brl(estimatedCommission)} por venda)`,
          `nota ${product.rating} com ${product.soldCount} vendidos`,
          ...(product.storeRating !== undefined ? [`loja nota ${product.storeRating}`] : []),
        ],
      });
    }

    return { curated, rejected };
  }
}
