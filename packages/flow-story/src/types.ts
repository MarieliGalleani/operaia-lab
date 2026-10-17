/**
 * Tipos do andar Flow Story — marketing de afiliados (marketplace neutro).
 *
 * O andar nao conhece nenhum marketplace pelo nome: os produtos chegam como
 * dado (export do portal de afiliados, planilha ou API plugada depois) e os
 * links passam por um AffiliateLinkProvider trocavel.
 */

/** Produto candidato vindo do portal de afiliados (ou de uma planilha). */
export interface ProductCandidate {
  readonly id: string;
  readonly title: string;
  /** URL publica do produto (sem tracking). */
  readonly url: string;
  /** Preco em reais. */
  readonly price: number;
  /** Comissao do afiliado como fracao (0.08 = 8%). */
  readonly commissionRate: number;
  /** Nota media do produto (0 a 5). */
  readonly rating: number;
  /** Quantidade vendida informada pelo marketplace. */
  readonly soldCount: number;
  readonly category: string;
  /** Nota da loja/vendedor (0 a 5), quando o portal informar. */
  readonly storeRating?: number;
}

/** Canais onde a Story sabe escrever. */
export type FlowStoryChannel = "instagram" | "whatsapp" | "telegram" | "tiktok";

export const FLOW_STORY_CHANNELS: readonly FlowStoryChannel[] = [
  "instagram",
  "whatsapp",
  "telegram",
  "tiktok",
];

export interface FlowStoryConfig {
  /** Nicho do perfil (ex.: "casa e organizacao"). */
  readonly niche: string;
  /** Categorias aceitas; vazio = todas. Comparacao sem acento/caixa. */
  readonly categories?: readonly string[];
  /** Canais declarados no cadastro de afiliado. So esses recebem texto. */
  readonly channels: readonly FlowStoryChannel[];
  /** Nota minima do produto (padrao 4.5). */
  readonly minRating?: number;
  /** Nota minima da loja, quando informada (padrao 4.5). */
  readonly minStoreRating?: number;
  /** Comissao minima como fracao (padrao 0.05). */
  readonly minCommissionRate?: number;
  /** Vendas minimas (padrao 50). */
  readonly minSoldCount?: number;
  /** Quantos produtos a Flow entrega por rodada (padrao 5). */
  readonly maxProducts?: number;
  /** Tom de voz do perfil (ex.: "leve e divertido"). */
  readonly tone?: string;
}

/** Saida da Flow: produto aprovado na curadoria, com motivo legivel. */
export interface CuratedProduct {
  readonly product: ProductCandidate;
  /** Pontuacao 0..100 (maior = melhor oportunidade). */
  readonly score: number;
  /** Comissao estimada por venda, em reais. */
  readonly estimatedCommission: number;
  readonly reasons: readonly string[];
  readonly affiliateUrl: string;
  /** true quando o link ainda nao tem tracking (provider manual). */
  readonly linkPending: boolean;
}

export interface RejectedProduct {
  readonly productId: string;
  readonly title: string;
  readonly reason: string;
}

export type DraftStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

/** Saida da Story: rascunho de post que SEMPRE espera aprovacao humana. */
export interface PostDraft {
  readonly id: string;
  readonly productId: string;
  readonly channel: FlowStoryChannel;
  readonly text: string;
  readonly hashtags: readonly string[];
  readonly affiliateUrl: string;
  /** Aviso obrigatorio de link de afiliado (ja incluido no texto). */
  readonly disclosure: string;
  readonly status: DraftStatus;
  /** "llm" quando a Story escreveu; "template" quando caiu no fallback. */
  readonly source: "llm" | "template";
}

export interface FlowStoryRun {
  readonly curated: readonly CuratedProduct[];
  readonly rejected: readonly RejectedProduct[];
  readonly drafts: readonly PostDraft[];
}
