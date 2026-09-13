import { z } from "zod";

export const marketingStageIdSchema = z.enum([
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
  briefing: z.string(),
  status: marketingCampaignStatusSchema,
  currentStage: marketingStageIdSchema.nullable(),
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
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** ~4.5MB de arquivo original (base64 tem overhead de ~33%). */
const MAX_ATTACHMENT_BASE64_LENGTH = 6_000_000;

export const createCampaignBodySchema = z.object({
  niche: z.string().min(2).max(160),
  briefing: z.string().min(10).max(4000),
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
