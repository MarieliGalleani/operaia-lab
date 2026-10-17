/**
 * Aprendizado do andar: le o relatorio de cliques/vendas do portal de
 * afiliados (por subId) e descobre o que vende mais — angulo, canal e
 * horario. A proxima rodada usa isso: o angulo vencedor vira a versao A e
 * os horarios vencedores substituem as sugestoes iniciais.
 *
 * So declara vencedor com dado suficiente (MIN_CLICKS). Abaixo disso o
 * relatorio diz "ainda testando", para nao tirar conclusao de 3 cliques.
 */

import { normalizeText } from "./flow-robot.js";
import { SALES_ANGLES, type SalesAngle } from "./sales-playbook.js";
import type { FlowStoryChannel, PostDraft } from "./types.js";

export interface PerformanceRow {
  readonly subId: string;
  readonly clicks: number;
  readonly orders: number;
  /** Comissao recebida em reais. */
  readonly commission: number;
}

export interface GroupStats {
  readonly key: string;
  readonly label: string;
  readonly clicks: number;
  readonly orders: number;
  readonly commission: number;
  /** pedidos / cliques (0..1). */
  readonly conversion: number;
  /** comissao / clique, em reais — a metrica que decide o vencedor. */
  readonly earningsPerClick: number;
}

export interface LearningReport {
  readonly matchedDrafts: number;
  readonly unmatchedSubIds: readonly string[];
  readonly totals: GroupStats;
  readonly byAngle: readonly GroupStats[];
  readonly byChannel: readonly GroupStats[];
  readonly byTime: readonly GroupStats[];
  /** null = ainda sem dado suficiente para escolher. */
  readonly bestAngle: SalesAngle | null;
  readonly bestChannel: FlowStoryChannel | null;
  /** Melhores horarios por canal (ate 2), quando ha dado suficiente. */
  readonly bestTimes: Partial<Record<FlowStoryChannel, readonly string[]>>;
  readonly insights: readonly string[];
}

/** Cliques minimos num grupo para ele poder ser declarado vencedor. */
export const MIN_CLICKS = 30;

function stats(key: string, label: string, rows: readonly PerformanceRow[]): GroupStats {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const orders = rows.reduce((s, r) => s + r.orders, 0);
  const commission = Math.round(rows.reduce((s, r) => s + r.commission, 0) * 100) / 100;
  return {
    key,
    label,
    clicks,
    orders,
    commission,
    conversion: clicks > 0 ? orders / clicks : 0,
    earningsPerClick: clicks > 0 ? Math.round((commission / clicks) * 100) / 100 : 0,
  };
}

function group<T extends string>(
  pairs: readonly { key: T; label: string; row: PerformanceRow }[],
): GroupStats[] {
  const map = new Map<T, { label: string; rows: PerformanceRow[] }>();
  for (const { key, label, row } of pairs) {
    const entry = map.get(key) ?? { label, rows: [] };
    entry.rows.push(row);
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([key, v]) => stats(key, v.label, v.rows))
    .sort((a, b) => b.earningsPerClick - a.earningsPerClick || b.clicks - a.clicks);
}

function winner(groups: readonly GroupStats[]): GroupStats | null {
  const eligible = groups.filter((g) => g.clicks >= MIN_CLICKS);
  if (eligible.length < 2) return null;
  const [first, second] = eligible;
  return first!.earningsPerClick > second!.earningsPerClick ? first! : null;
}

function brl(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function learnFromResults(
  drafts: readonly PostDraft[],
  results: readonly PerformanceRow[],
): LearningReport {
  const bySubId = new Map(drafts.map((d) => [d.trackingSubId, d] as const));
  const matched: { draft: PostDraft; row: PerformanceRow }[] = [];
  const unmatched: string[] = [];
  for (const row of results) {
    const draft = bySubId.get(row.subId);
    if (draft) matched.push({ draft, row });
    else unmatched.push(row.subId);
  }

  const byAngle = group(
    matched.map(({ draft, row }) => ({ key: draft.angle, label: draft.angleLabel, row })),
  );
  const byChannel = group(
    matched.map(({ draft, row }) => ({ key: draft.channel, label: draft.channel, row })),
  );
  const byTime = group(
    matched.map(({ draft, row }) => ({
      key: `${draft.channel} ${draft.suggestedTime}`,
      label: `${draft.channel} às ${draft.suggestedTime}`,
      row,
    })),
  );

  const angleWin = winner(byAngle);
  const channelWin = winner(byChannel);

  const bestTimes: Partial<Record<FlowStoryChannel, string[]>> = {};
  for (const g of byTime) {
    if (g.clicks < MIN_CLICKS) continue;
    const [channel, time] = g.key.split(" ") as [FlowStoryChannel, string];
    const list = (bestTimes[channel] ??= []);
    if (list.length < 2) list.push(time);
  }

  const totals = stats("total", "Total", matched.map((m) => m.row));
  const insights: string[] = [];
  if (matched.length === 0) {
    insights.push("Nenhum subId do relatório bateu com os posts desta rodada. Confira se o relatório é desta campanha.");
  } else {
    insights.push(
      `${totals.clicks} cliques, ${totals.orders} pedidos e ${brl(totals.commission)} de comissão nos posts da rodada.`,
    );
    insights.push(
      angleWin
        ? `O ângulo "${angleWin.label}" rendeu mais: ${brl(angleWin.earningsPerClick)} por clique. Ele vira a versão A da próxima rodada.`
        : `Ângulos ainda empatados ou com menos de ${MIN_CLICKS} cliques cada: o teste A/B continua.`,
    );
    if (channelWin) {
      insights.push(`${channelWin.label} é o canal que mais rende por clique (${brl(channelWin.earningsPerClick)}).`);
    }
    for (const [channel, times] of Object.entries(bestTimes)) {
      insights.push(`Em ${channel}, publicar às ${times!.join(" e ")} rendeu mais.`);
    }
  }
  if (unmatched.length > 0) {
    insights.push(`${unmatched.length} linha(s) do relatório são de outros links e ficaram de fora.`);
  }

  return {
    matchedDrafts: matched.length,
    unmatchedSubIds: unmatched,
    totals,
    byAngle,
    byChannel,
    byTime,
    bestAngle: angleWin && angleWin.key in SALES_ANGLES ? (angleWin.key as SalesAngle) : null,
    bestChannel: (channelWin?.key as FlowStoryChannel | undefined) ?? null,
    bestTimes,
    insights,
  };
}

const RESULT_ALIASES: Readonly<Record<string, keyof PerformanceRow>> = {
  sub_id: "subId",
  subid: "subId",
  sub_id1: "subId",
  cliques: "clicks",
  clicks: "clicks",
  pedidos: "orders",
  vendas: "orders",
  orders: "orders",
  comissao: "commission",
  comissao_estimada: "commission",
  commission: "commission",
};

function parseAmount(raw: string): number {
  const clean = raw.replace(/R\$|\s/g, "");
  const value = clean.includes(",") ? Number(clean.replace(/\./g, "").replace(",", ".")) : Number(clean);
  return Number.isFinite(value) ? value : 0;
}

/** Le o relatorio do portal (CSV) com colunas sub_id, cliques, pedidos, comissao. */
export function parseResultsCsv(csv: string): PerformanceRow[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = lines[0]!
    .split(sep)
    .map((h) => RESULT_ALIASES[normalizeText(h).replace(/[\s-]+/g, "_")]);
  return lines.slice(1).flatMap((line) => {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Partial<Record<keyof PerformanceRow, string>> = {};
    headers.forEach((h, i) => {
      if (h) row[h] = cells[i] ?? "";
    });
    if (!row.subId) return [];
    return [
      {
        subId: row.subId,
        clicks: parseAmount(row.clicks ?? "0"),
        orders: parseAmount(row.orders ?? "0"),
        commission: parseAmount(row.commission ?? "0"),
      },
    ];
  });
}
