/**
 * Acompanhamento continuo por cliente (P1.X Fase 7) — Trafego Pago e
 * Performance, depois que a campanha inicial do Mercurio ja definiu o
 * Plano de Trafego e o Framework de Performance daquele cliente.
 *
 * Sem integracao real com conta de anuncios ainda (Meta/Google Ads) —
 * os valores sao lancados manualmente aqui. As telas mostram o plano
 * original (referencia) ao lado dos lancamentos reais.
 */
import { prisma } from "@operaia/database";

export type ClientMetricKind = "TRAFEGO" | "PERFORMANCE";

export interface MetricEntry {
  readonly id: string;
  readonly kind: ClientMetricKind;
  readonly metric: string;
  readonly channel: string | null;
  readonly period: string;
  readonly value: number;
  readonly note: string | null;
  readonly createdAt: string;
}

export async function listMetricEntries(
  clientId: string,
  kind: ClientMetricKind,
): Promise<readonly MetricEntry[]> {
  const rows = await prisma.clientMetricEntry.findMany({
    where: { clientId, kind },
    orderBy: { period: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    metric: row.metric,
    channel: row.channel,
    period: row.period.toISOString(),
    value: row.value,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createMetricEntry(input: {
  clientId: string;
  kind: ClientMetricKind;
  metric: string;
  channel?: string;
  period: string;
  value: number;
  note?: string;
}): Promise<MetricEntry> {
  const row = await prisma.clientMetricEntry.create({
    data: {
      clientId: input.clientId,
      kind: input.kind,
      metric: input.metric,
      channel: input.channel,
      period: new Date(input.period),
      value: input.value,
      note: input.note,
    },
  });
  return {
    id: row.id,
    kind: row.kind,
    metric: row.metric,
    channel: row.channel,
    period: row.period.toISOString(),
    value: row.value,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function deleteMetricEntry(id: string): Promise<void> {
  await prisma.clientMetricEntry.delete({ where: { id } });
}

/** Referencia definida pelo Mercurio na campanha mais recente e concluida deste cliente —
 * o "plano" ao lado do qual os lancamentos reais de trafego/performance sao comparados. */
export async function getClientLatestPlans(clientId: string): Promise<{
  planoTrafego: string | null;
  frameworkPerformance: string | null;
}> {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { clientId, status: "DONE" },
    orderBy: { createdAt: "desc" },
    select: { planoTrafego: true, frameworkPerformance: true },
  });
  return {
    planoTrafego: campaign?.planoTrafego ?? null,
    frameworkPerformance: campaign?.frameworkPerformance ?? null,
  };
}
