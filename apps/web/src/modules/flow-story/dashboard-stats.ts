/**
 * Números do painel do andar Flow Story, calculados a partir da mesma rodada
 * que a Sala de Aprovação usa (review-queue.ts). Funções puras: a tela só
 * desenha o que sai daqui.
 */

import {
  CHANNEL_LABEL,
  SIGNAL_LABEL,
  countByStatus,
  type DraftStatus,
  type FlowStoryChannel,
  type ReviewRun,
} from "./review-queue";

export interface FunnelStep {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly hint: string;
}

export interface RankedProduct {
  readonly id: string;
  readonly title: string;
  readonly score: number;
  readonly estimatedCommission: number;
  readonly price: number;
  readonly category: string;
  readonly linkPending: boolean;
  /** Sinais de venda em português (ex.: "Em alta"). */
  readonly signals: readonly string[];
}

export interface ReasonBucket {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly examples: readonly string[];
}

export interface ChannelRow {
  readonly channel: FlowStoryChannel;
  readonly label: string;
  readonly approved: number;
  readonly pending: number;
  readonly rejected: number;
  readonly total: number;
}

export interface DashboardStats {
  readonly analyzed: number;
  readonly chosen: number;
  readonly rejectedProducts: number;
  readonly drafts: Readonly<Record<DraftStatus, number>>;
  readonly totalDrafts: number;
  /** Comissão somando 1 venda de cada produto escolhido. */
  readonly potentialCommission: number;
  /** Comissão somando 1 venda de cada produto com post aprovado. */
  readonly approvedCommission: number;
  readonly averageScore: number;
  /** Fração dos textos escritos pela IA (o resto caiu no template seguro). */
  readonly aiShare: number;
  readonly pendingLinks: number;
  readonly funnel: readonly FunnelStep[];
  readonly ranking: readonly RankedProduct[];
  readonly reasons: readonly ReasonBucket[];
  readonly channels: readonly ChannelRow[];
}

const REASON_RULES: readonly { id: string; label: string; test: RegExp }[] = [
  { id: "commission", label: "Comissão baixa", test: /comissao|comissão/i },
  { id: "rating", label: "Nota do produto baixa", test: /^nota /i },
  { id: "store", label: "Loja mal avaliada", test: /loja/i },
  { id: "sales", label: "Poucas vendas", test: /poucas vendas/i },
  { id: "niche", label: "Fora do nicho", test: /fora do nicho/i },
  { id: "top", label: "Ficou fora do top", test: /fora do top/i },
  { id: "category", label: "Categoria já cheia", test: /categoria cheia/i },
  { id: "duplicate", label: "Repetido", test: /repetido/i },
];

export function bucketReason(reason: string): { id: string; label: string } {
  const rule = REASON_RULES.find((r) => r.test.test(reason));
  return rule ? { id: rule.id, label: rule.label } : { id: "invalid", label: "Dados inválidos" };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeDashboard(run: ReviewRun): DashboardStats {
  const drafts = countByStatus(run);
  const totalDrafts = run.drafts.length;
  const chosen = run.curated.length;
  const rejectedProducts = run.rejected.length;

  const approvedProductIds = new Set(
    run.drafts.filter((d) => d.status === "APPROVED").map((d) => d.productId),
  );

  const potentialCommission = round2(
    run.curated.reduce((sum, c) => sum + c.estimatedCommission, 0),
  );
  const approvedCommission = round2(
    run.curated
      .filter((c) => approvedProductIds.has(c.product.id))
      .reduce((sum, c) => sum + c.estimatedCommission, 0),
  );

  const averageScore =
    chosen === 0 ? 0 : Math.round(run.curated.reduce((s, c) => s + c.score, 0) / chosen);

  const aiShare =
    totalDrafts === 0 ? 0 : run.drafts.filter((d) => d.source === "llm").length / totalDrafts;

  const ranking: RankedProduct[] = [...run.curated]
    .sort((a, b) => b.score - a.score)
    .map((c) => ({
      id: c.product.id,
      title: c.product.title,
      score: c.score,
      estimatedCommission: c.estimatedCommission,
      price: c.product.price,
      category: c.product.category,
      linkPending: c.linkPending,
      signals: (c.signals ?? []).map((sig) => SIGNAL_LABEL[sig] ?? sig),
    }));

  const reasonMap = new Map<string, { label: string; count: number; examples: string[] }>();
  for (const r of run.rejected) {
    const bucket = bucketReason(r.reason);
    const entry = reasonMap.get(bucket.id) ?? { label: bucket.label, count: 0, examples: [] };
    entry.count += 1;
    if (entry.examples.length < 3) entry.examples.push(r.title || r.productId);
    reasonMap.set(bucket.id, entry);
  }
  const reasons: ReasonBucket[] = [...reasonMap.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const channelMap = new Map<FlowStoryChannel, ChannelRow>();
  for (const d of run.drafts) {
    const row = channelMap.get(d.channel) ?? {
      channel: d.channel,
      label: CHANNEL_LABEL[d.channel],
      approved: 0,
      pending: 0,
      rejected: 0,
      total: 0,
    };
    channelMap.set(d.channel, {
      ...row,
      approved: row.approved + (d.status === "APPROVED" ? 1 : 0),
      pending: row.pending + (d.status === "PENDING_APPROVAL" ? 1 : 0),
      rejected: row.rejected + (d.status === "REJECTED" ? 1 : 0),
      total: row.total + 1,
    });
  }
  const order = Object.keys(CHANNEL_LABEL) as FlowStoryChannel[];
  const channels = order.flatMap((c) => {
    const row = channelMap.get(c);
    return row ? [row] : [];
  });

  const funnel: FunnelStep[] = [
    { id: "analyzed", label: "Analisados", value: chosen + rejectedProducts, hint: "produtos que a Flow avaliou" },
    { id: "chosen", label: "Escolhidos", value: chosen, hint: "passaram na curadoria da Flow" },
    { id: "written", label: "Posts escritos", value: totalDrafts, hint: "textos que a Story preparou" },
    { id: "approved", label: "Aprovados", value: drafts.APPROVED, hint: "liberados por você para publicar" },
  ];

  return {
    analyzed: chosen + rejectedProducts,
    chosen,
    rejectedProducts,
    drafts,
    totalDrafts,
    potentialCommission,
    approvedCommission,
    averageScore,
    aiShare,
    pendingLinks: run.curated.filter((c) => c.linkPending).length,
    funnel,
    ranking,
    reasons,
    channels,
  };
}
