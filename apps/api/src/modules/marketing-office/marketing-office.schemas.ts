import { z } from "zod";

export const marketingStageIdSchema = z.enum([
  "MAPA_NICHO",
  "CRIATIVOS",
  "LANDING_PAGE",
  "PITCH_DECK",
  "PLANO_GTM",
  "PLAYBOOK_VENDAS",
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
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createCampaignBodySchema = z.object({
  niche: z.string().min(2).max(160),
  briefing: z.string().min(10).max(4000),
});
