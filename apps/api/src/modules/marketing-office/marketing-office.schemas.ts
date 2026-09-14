import { z } from "zod";

export const marketingStageIdSchema = z.enum([
  "DIAGNOSTICO",
  "MAPA_NICHO",
  "CRIATIVOS",
  "LANDING_PAGE",
  "PITCH_DECK",
  "PLANO_GTM",
  "PLAYBOOK_VENDAS",
  "VIDEO_ROTEIRO",
  "PLANO_TRAFEGO",
  "FRAMEWORK_PERFORMANCE",
]);

export const marketingCampaignStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "DONE",
  "ERROR",
]);

export const marketingCampaignSchema = z.object({
  id: z.string(),
  niche: z.string(),
  nicheId: z.string(),
  briefing: z.string(),
  status: marketingCampaignStatusSchema,
  currentStage: marketingStageIdSchema.nullable(),
  diagnostico: z.string().nullable(),
  nicheMap: z.string().nullable(),
  creatives: z.string().nullable(),
  landingPageHtml: z.string().nullable(),
  pitchDeck: z.string().nullable(),
  gtmPlan: z.string().nullable(),
  salesPlaybook: z.string().nullable(),
  videoRoteiro: z.string().nullable(),
  planoTrafego: z.string().nullable(),
  frameworkPerformance: z.string().nullable(),
  attachmentName: z.string().nullable(),
  attachmentMimeType: z.string().nullable(),
  errorMessage: z.string().nullable(),
  /** Ids das etapas cujo conteudo veio do fallback deterministico (IA indisponivel no momento). */
  fallbackStages: z.array(marketingStageIdSchema),
  /** Nome do Cliente rastreado (Fase 3), quando a campanha foi ligada a um. */
  clientName: z.string().nullable(),
  /** Soma da duracao real (ms) das chamadas de LLM de cada etapa ja concluida. */
  totalDurationMs: z.number().nullable(),
  /** Fracao de etapas que reaproveitaram conhecimento de outra campanha do mesmo nicho (0 a 1). */
  reuseRatio: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** ~4.5MB de arquivo original (base64 tem overhead de ~33%). */
const MAX_ATTACHMENT_BASE64_LENGTH = 6_000_000;

export const createCampaignBodySchema = z.object({
  niche: z.string().min(2).max(160),
  briefing: z.string().min(10).max(4000),
  clientName: z.string().min(1).max(160).optional(),
  attachmentName: z.string().max(200).optional(),
  attachmentMimeType: z.string().max(100).optional(),
  attachmentBase64: z.string().max(MAX_ATTACHMENT_BASE64_LENGTH).optional(),
});

export const marketingAttachmentSchema = z.object({
  name: z.string(),
  mimeType: z.string(),
  base64: z.string(),
});

export const nicheSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  campaignCount: z.number(),
});

export const clientSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  nicheName: z.string(),
  campaignCount: z.number(),
  setupPaid: z.boolean(),
  recurringActive: z.boolean(),
});

export const clientMetricKindSchema = z.enum(["TRAFEGO", "PERFORMANCE"]);

export const metricEntrySchema = z.object({
  id: z.string(),
  kind: clientMetricKindSchema,
  metric: z.string(),
  channel: z.string().nullable(),
  period: z.string(),
  value: z.number(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export const createMetricEntryBodySchema = z.object({
  kind: clientMetricKindSchema,
  metric: z.string().min(1).max(80),
  channel: z.string().max(80).optional(),
  period: z.string().min(1),
  value: z.number(),
  note: z.string().max(500).optional(),
});

export const clientPlansSchema = z.object({
  planoTrafego: z.string().nullable(),
  frameworkPerformance: z.string().nullable(),
});
