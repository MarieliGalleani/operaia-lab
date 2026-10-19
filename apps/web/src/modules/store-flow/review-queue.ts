/**
 * Fila de aprovação do andar Store Flow (Sala de Aprovação).
 *
 * Lê o JSON gerado pelo CLI do pacote @operaia/store-flow (`run:csv`) e
 * aplica as MESMAS regras de revisão do pacote (reviewDraft): não aprova sem
 * o aviso de afiliado, e cada rascunho só é decidido uma vez — mas aqui dá
 * para desfazer, porque nada foi publicado ainda.
 *
 * O web não depende dos pacotes do backend (convenção do repo), por isso os
 * tipos abaixo espelham só o que a tela usa.
 */

export type StoreFlowChannel = "instagram" | "whatsapp" | "telegram" | "tiktok";
export type DraftStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface ReviewProduct {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly price: number;
  readonly rating: number;
  readonly soldCount: number;
  readonly category: string;
}

export interface ReviewCurated {
  readonly product: ReviewProduct;
  readonly score: number;
  readonly estimatedCommission: number;
  readonly reasons: readonly string[];
  readonly affiliateUrl: string;
  readonly linkPending: boolean;
  readonly signals?: readonly string[];
}

export const SIGNAL_LABEL: Readonly<Record<string, string>> = {
  "em-alta": "Em alta",
  desconto: "Com desconto",
  campeao: "Campeão de vendas",
  "loja-top": "Loja top",
};

export interface ReviewDraft {
  readonly id: string;
  readonly productId: string;
  readonly channel: StoreFlowChannel;
  /** Teste A/B (rodadas antigas não têm estes campos). */
  readonly variant?: "A" | "B";
  readonly angleLabel?: string;
  readonly suggestedTime?: string;
  readonly text: string;
  readonly hashtags: readonly string[];
  readonly affiliateUrl: string;
  readonly disclosure: string;
  readonly status: DraftStatus;
  readonly source: "llm" | "template";
}

export interface ReviewRun {
  readonly curated: readonly ReviewCurated[];
  readonly rejected: readonly { productId: string; title: string; reason: string }[];
  readonly drafts: readonly ReviewDraft[];
}

export const CHANNEL_LABEL: Readonly<Record<StoreFlowChannel, string>> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  tiktok: "TikTok (roteiro)",
};

const CHANNELS = new Set<string>(Object.keys(CHANNEL_LABEL));
const STATUSES = new Set<string>(["PENDING_APPROVAL", "APPROVED", "REJECTED"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Valida o JSON da rodada. Lança erro em português com o motivo. */
export function parseRun(raw: string): ReviewRun {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Arquivo inválido: não é um JSON.");
  }
  if (!isObject(data) || !Array.isArray(data.drafts) || !Array.isArray(data.curated)) {
    throw new Error("Esse JSON não é uma rodada do Store Flow (faltam drafts/curated).");
  }
  for (const [i, d] of data.drafts.entries()) {
    if (
      !isObject(d) ||
      typeof d.id !== "string" ||
      typeof d.productId !== "string" ||
      typeof d.text !== "string" ||
      typeof d.disclosure !== "string" ||
      typeof d.affiliateUrl !== "string" ||
      !CHANNELS.has(String(d.channel)) ||
      !STATUSES.has(String(d.status))
    ) {
      throw new Error(`Rascunho ${i + 1} está incompleto.`);
    }
  }
  return {
    curated: data.curated as ReviewCurated[],
    rejected: Array.isArray(data.rejected) ? (data.rejected as ReviewRun["rejected"]) : [],
    drafts: data.drafts as ReviewDraft[],
  };
}

export function extractUrls(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s<>"]+/g)].map((m) => m[0]);
}

export interface ReviewOptions {
  /** Link ainda sem rastreio: a Marieli troca pela URL do portal no texto. */
  readonly linkPending?: boolean;
}

/** Motivo pelo qual o texto não pode ser aprovado, ou null. */
export function approvalBlocker(
  draft: ReviewDraft,
  text: string,
  options: ReviewOptions = {},
): string | null {
  if (!text.trim()) return "O texto está vazio.";
  if (!text.includes(draft.disclosure)) return "O aviso de link de afiliado foi removido.";
  if (options.linkPending) {
    const urls = extractUrls(text);
    if (urls.length === 0) return "O texto ficou sem link.";
    if (urls.every((u) => u === draft.affiliateUrl)) {
      return "Troque a URL do produto pelo seu link de afiliado (copie do portal).";
    }
    return null;
  }
  if (!text.includes(draft.affiliateUrl)) return "O link de afiliado foi removido.";
  return null;
}

export function decide(
  draft: ReviewDraft,
  decision: Exclude<DraftStatus, "PENDING_APPROVAL">,
  text = draft.text,
  options: ReviewOptions = {},
): ReviewDraft {
  const finalText = text.trim();
  if (decision === "APPROVED") {
    const blocker = approvalBlocker(draft, finalText, options);
    if (blocker) throw new Error(blocker);
    // Link colado à mão passa a ser o link oficial do rascunho.
    const pasted = options.linkPending
      ? extractUrls(finalText).find((u) => u !== draft.affiliateUrl)
      : undefined;
    return { ...draft, text: finalText, status: decision, affiliateUrl: pasted ?? draft.affiliateUrl };
  }
  return { ...draft, text: finalText || draft.text, status: decision };
}

/** Volta para pendente (nada foi publicado, então dá para mudar de ideia). */
export function reopen(draft: ReviewDraft): ReviewDraft {
  return { ...draft, status: "PENDING_APPROVAL" };
}

export function replaceDraft(run: ReviewRun, next: ReviewDraft): ReviewRun {
  return { ...run, drafts: run.drafts.map((d) => (d.id === next.id ? next : d)) };
}

export function countByStatus(run: ReviewRun): Readonly<Record<DraftStatus, number>> {
  const counts: Record<DraftStatus, number> = { PENDING_APPROVAL: 0, APPROVED: 0, REJECTED: 0 };
  for (const d of run.drafts) counts[d.status] += 1;
  return counts;
}

/** JSON só com os aprovados — o que pode ir para publicação. */
export function exportApproved(run: ReviewRun): string {
  return JSON.stringify(
    run.drafts
      .filter((d) => d.status === "APPROVED")
      .map(({ id, productId, channel, variant, suggestedTime, text, affiliateUrl }) => ({
        id,
        productId,
        channel,
        variant,
        suggestedTime,
        text,
        affiliateUrl,
      })),
    null,
    2,
  );
}

const STORAGE_KEY = "store-flow:review-run";

/** Guarda a fila neste navegador para não perder decisões ao recarregar. */
export function saveRun(run: ReviewRun | null): void {
  try {
    if (run) localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // armazenamento indisponível: a fila continua só em memória
  }
}

export function loadSavedRun(): ReviewRun | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseRun(raw) : null;
  } catch {
    return null;
  }
}
