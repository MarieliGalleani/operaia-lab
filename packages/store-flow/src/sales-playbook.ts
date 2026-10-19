/**
 * Manual de vendas da Driele — as taticas de afiliado que mais convertem,
 * transformadas em regras que o codigo aplica:
 *
 * 1. Angulo certo para o produto: o sinal que a Flow achou (em alta,
 *    desconto, campeao de vendas) decide como abrir o texto.
 * 2. Gancho curto na primeira linha, um beneficio concreto, chamada clara.
 * 3. Teste A/B: cada post sai em duas versoes com angulos (e horarios)
 *    diferentes, cada uma com seu subId, para o relatorio mostrar qual vende.
 * 4. Horario: sugestoes iniciais por canal; o aprendizado (learning.ts)
 *    substitui pelos horarios que venderam mais nos seus resultados.
 */

import type { CuratedProduct, StoreFlowChannel } from "./types.js";

export type SalesAngle = "em-alta" | "oferta" | "prova-social" | "dor-solucao" | "curiosidade";
export type DraftVariant = "A" | "B";

export interface AngleSpec {
  readonly id: SalesAngle;
  readonly label: string;
  /** Instrucao para o LLM. */
  readonly brief: string;
}

export const SALES_ANGLES: Readonly<Record<SalesAngle, AngleSpec>> = {
  "em-alta": {
    id: "em-alta",
    label: "Em alta",
    brief: "abra mostrando que muita gente esta comprando agora (use o numero de vendidos no mes, se houver)",
  },
  oferta: {
    id: "oferta",
    label: "Oferta",
    brief: "abra pelo preco e pelo desconto real (preco de antes e de agora), sem inventar urgencia",
  },
  "prova-social": {
    id: "prova-social",
    label: "Prova social",
    brief: "abra pela nota e pela quantidade de vendidos: confianca de quem ja comprou",
  },
  "dor-solucao": {
    id: "dor-solucao",
    label: "Problema → solução",
    brief: "abra por um incomodo comum do dia a dia que esse produto resolve, depois apresente o produto",
  },
  curiosidade: {
    id: "curiosidade",
    label: "Curiosidade",
    brief: "abra com uma pergunta ou frase curiosa sobre o uso do produto, sem exagero",
  },
};

/**
 * Dois angulos por produto, do mais forte para o segundo (versao A e B).
 * `preferred` (o vencedor aprendido) vira a versao A quando cabe no produto.
 */
export function anglesFor(
  product: CuratedProduct,
  preferred?: SalesAngle | null,
): readonly [SalesAngle, SalesAngle] {
  const order: SalesAngle[] = [];
  if (product.signals.includes("em-alta")) order.push("em-alta");
  if (product.signals.includes("desconto")) order.push("oferta");
  if (product.signals.includes("campeao") || product.product.rating >= 4.7) order.push("prova-social");
  order.push("dor-solucao", "curiosidade");
  if (preferred && order.includes(preferred)) order.unshift(preferred);
  const unique = [...new Set(order)];
  return [unique[0]!, unique[1]!];
}

/**
 * Horarios de partida por canal (horario de Brasilia). Sao hipoteses para o
 * primeiro teste — a versao A e a B saem em horarios diferentes para medir.
 */
export const DEFAULT_POST_TIMES: Readonly<Record<StoreFlowChannel, readonly [string, string]>> = {
  instagram: ["12:00", "19:30"],
  whatsapp: ["12:00", "20:00"],
  telegram: ["09:00", "20:00"],
  tiktok: ["19:00", "21:30"],
};

function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

/** Texto seguro por angulo (usado quando o LLM falha ou quebra regra). */
export function angleTemplate(
  product: CuratedProduct,
  channel: StoreFlowChannel,
  angle: SalesAngle,
): string {
  const p = product.product;
  const price = `R$ ${formatPrice(p.price)}`;
  const from = p.originalPrice !== undefined && p.originalPrice > p.price
    ? ` (antes R$ ${formatPrice(p.originalPrice)})`
    : "";
  const hook: Record<SalesAngle, string> = {
    "em-alta": p.soldLast30Days
      ? `${p.soldLast30Days} pessoas compraram no último mês 👀`
      : "Esse aqui está saindo muito 👀",
    oferta: `Baixou: ${price}${from} 🏷️`,
    "prova-social": `Nota ${p.rating} e mais de ${p.soldCount} vendidos ⭐`,
    "dor-solucao": `Sabe aquele perrengue do dia a dia? Isso resolve 🙌`,
    curiosidade: "Você não sabia que precisava disso até ver 👇",
  };
  if (channel === "tiktok") {
    return [
      `[Gancho] ${hook[angle]}`,
      `[Produto] ${p.title} — nota ${p.rating}, ${p.soldCount}+ vendidos.`,
      `[Chamada] Por ${price}. Link na bio!`,
    ].join("\n");
  }
  return [hook[angle], p.title, `⭐ ${p.rating} · ${p.soldCount}+ vendidos`, `💰 ${price}${from}`].join("\n");
}
