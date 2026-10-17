/**
 * Story — Escritora.
 *
 * Escreve com o LLM e passa por guardrails antes de virar rascunho:
 * - sem promessas proibidas (garantia, "melhor preco", urgencia falsa);
 * - nenhum valor em R$ diferente do preco real;
 * - aviso de link de afiliado e o link sempre presentes;
 * - limite de tamanho por canal.
 * Se o LLM falhar ou violar uma regra, cai num template seguro.
 * Todo rascunho sai PENDING_APPROVAL: quem publica e a Marieli.
 */

import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import { storyProfile } from "./profiles.js";
import type {
  CuratedProduct,
  FlowStoryChannel,
  FlowStoryConfig,
  PostDraft,
} from "./types.js";

export const AFFILIATE_DISCLOSURE =
  "Link de afiliado: posso receber comissão se você comprar por ele, sem custo extra para você.";

export const CHANNEL_MAX_CHARS: Readonly<Record<FlowStoryChannel, number>> = {
  instagram: 2200,
  whatsapp: 700,
  telegram: 1000,
  tiktok: 900,
};

const CHANNEL_BRIEF: Readonly<Record<FlowStoryChannel, string>> = {
  instagram: "legenda de post do Instagram: gancho na primeira linha, 3 a 5 linhas curtas, chamada para o link na bio ou nos stories",
  whatsapp: "mensagem de grupo de WhatsApp: curta, direta, 1 emoji no maximo por linha",
  telegram: "mensagem de canal do Telegram: titulo em uma linha, beneficios em topicos curtos",
  tiktok: "roteiro de video de 15 a 30 segundos: gancho (3s), mostrar o produto, chamada final",
};

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /garantid[oa]s?/i,
  /garantia de/i,
  /100\s?%/,
  /melhor pre[cç]o/i,
  /mais barato do (brasil|mundo)/i,
  /[uú]ltimas? unidades?/i,
  /s[oó] hoje/i,
  /cura|emagre[cç]a|emagrecimento r[aá]pido/i,
];

function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

function priceMentions(text: string): string[] {
  return [...text.matchAll(/R\$\s?([\d.]+(?:,\d{1,2})?)/g)].map((m) => m[1] ?? "");
}

function normalizePriceToken(token: string): string {
  const [int = "", dec = "00"] = token.replace(/\./g, "").split(",");
  return `${Number(int)},${dec.padEnd(2, "0")}`;
}

/** Retorna o motivo da violacao, ou null se o texto passou. */
export function checkStoryText(text: string, product: CuratedProduct): string | null {
  if (!text.trim()) return "texto vazio";
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) return `promessa proibida (${pattern.source})`;
  }
  const realPrice = normalizePriceToken(formatPrice(product.product.price));
  for (const mention of priceMentions(text)) {
    if (normalizePriceToken(mention) !== realPrice) {
      return `preco R$ ${mention} diferente do real (R$ ${formatPrice(product.product.price)})`;
    }
  }
  return null;
}

function slugTag(value: string): string {
  return (
    "#" +
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase()
  );
}

function sanitizeHashtags(raw: unknown, fallback: readonly string[]): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const tags = list
    .filter((t): t is string => typeof t === "string")
    .map((t) => slugTag(t.replace(/^#/, "")))
    .filter((t) => t.length > 1);
  const unique = [...new Set([...tags, ...fallback])];
  return unique.slice(0, 6);
}

/** Garante link + aviso no texto e respeita o limite do canal. */
export function finalizeText(
  body: string,
  channel: FlowStoryChannel,
  affiliateUrl: string,
  hashtags: readonly string[],
): string {
  const tail = [
    body.includes(affiliateUrl) ? "" : `👉 ${affiliateUrl}`,
    AFFILIATE_DISCLOSURE,
    channel === "instagram" || channel === "tiktok" ? hashtags.join(" ") : "",
  ]
    .filter(Boolean)
    .join("\n");
  const max = CHANNEL_MAX_CHARS[channel];
  const room = max - tail.length - 2;
  const trimmedBody =
    body.length > room ? `${body.slice(0, Math.max(room - 1, 0)).trimEnd()}…` : body;
  return `${trimmedBody.trim()}\n\n${tail}`;
}

export function templateText(product: CuratedProduct, channel: FlowStoryChannel): string {
  const p = product.product;
  const price = `R$ ${formatPrice(p.price)}`;
  switch (channel) {
    case "tiktok":
      return [
        `[Gancho] Olha esse achado de ${p.category.toLowerCase()} 👀`,
        `[Produto] ${p.title} — nota ${p.rating} e mais de ${p.soldCount} vendidos.`,
        `[Chamada] Por ${price}. Link na bio!`,
      ].join("\n");
    case "instagram":
      return [
        `Achado do dia: ${p.title} ✨`,
        `⭐ Nota ${p.rating} · ${p.soldCount}+ vendidos`,
        `💰 ${price}`,
        "Link nos stories e na bio.",
      ].join("\n");
    default:
      return [`🔎 ${p.title}`, `⭐ ${p.rating} · ${p.soldCount}+ vendidos`, `💰 ${price}`].join("\n");
  }
}

interface LLMStoryPayload {
  readonly text?: unknown;
  readonly hashtags?: unknown;
}

function parsePayload(content: string): LLMStoryPayload | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" ? (parsed as LLMStoryPayload) : null;
  } catch {
    return null;
  }
}

export function buildStorySystemPrompt(config: FlowStoryConfig): string {
  return [
    `Voce e ${storyProfile.name}, ${storyProfile.role} do andar Flow Story do OperaIA.lab.`,
    `Missao: ${storyProfile.mission}`,
    `Nicho do perfil: ${config.niche}. Tom de voz: ${config.tone ?? "proximo, leve e honesto"}.`,
    "Regras:",
    "- Use SOMENTE os dados do produto enviados. Nao invente beneficios, medidas ou numeros.",
    "- Se citar preco, use exatamente o preco informado.",
    "- Proibido: garantia, '100%', 'melhor preco', 'ultimas unidades', 'so hoje', promessas de saude.",
    "- Nao cite o nome do marketplace.",
    "- Escreva em portugues do Brasil.",
    'Responda apenas JSON: {"text": "...", "hashtags": ["...", "..."]}',
  ].join("\n");
}

function buildUserPrompt(product: CuratedProduct, channel: FlowStoryChannel): string {
  const p = product.product;
  return [
    `Formato: ${CHANNEL_BRIEF[channel]}.`,
    "Produto:",
    `- titulo: ${p.title}`,
    `- categoria: ${p.category}`,
    `- preco: R$ ${formatPrice(p.price)}`,
    `- nota: ${p.rating} (${p.soldCount} vendidos)`,
    "Nao inclua o link nem o aviso de afiliado — eles sao adicionados depois.",
  ].join("\n");
}

export class StoryWriter {
  constructor(private readonly llm: LLMProvider) {}

  async write(
    product: CuratedProduct,
    channel: FlowStoryChannel,
    config: FlowStoryConfig,
  ): Promise<PostDraft> {
    const fallbackTags = [slugTag(config.niche), slugTag(product.product.category), "#achadinhos"];
    let body = templateText(product, channel);
    let hashtags = sanitizeHashtags([], fallbackTags);
    let source: PostDraft["source"] = "template";

    const messages: LLMMessage[] = [
      { role: "system", content: buildStorySystemPrompt(config) },
      { role: "user", content: buildUserPrompt(product, channel) },
    ];

    try {
      const completion = await this.llm.complete(messages, { temperature: 0.7, maxTokens: 600 });
      const payload = parsePayload(completion.content);
      const text = typeof payload?.text === "string" ? payload.text.trim() : "";
      if (text && checkStoryText(text, product) === null) {
        body = text;
        hashtags = sanitizeHashtags(payload?.hashtags, fallbackTags);
        source = "llm";
      }
    } catch {
      // LLM indisponivel: segue com o template seguro.
    }

    return {
      id: `${product.product.id}-${channel}`,
      productId: product.product.id,
      channel,
      text: finalizeText(body, channel, product.affiliateUrl, hashtags),
      hashtags,
      affiliateUrl: product.affiliateUrl,
      disclosure: AFFILIATE_DISCLOSURE,
      status: "PENDING_APPROVAL",
      source,
    };
  }
}
