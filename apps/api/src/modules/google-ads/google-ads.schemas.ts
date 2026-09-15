import { z } from "zod";

export const connectionStatusSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  customerId: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  lastError: z.string().nullable(),
});

export const connectQuerySchema = z.object({
  customerId: z.string().min(1),
  loginCustomerId: z.string().optional(),
});

export const negativeKeywordRecommendationSchema = z.object({
  term: z.string(),
  campaignId: z.string(),
  campaignName: z.string(),
  costBrl: z.number(),
  clicks: z.number(),
  reason: z.string(),
});

export const lostImpressionShareInsightSchema = z.object({
  campaignId: z.string(),
  campaignName: z.string(),
  impressionSharePct: z.number(),
  lostToBudgetPct: z.number(),
  lostToRankPct: z.number(),
  mainCause: z.enum(["orcamento", "lance_ou_qualidade", "sem_perda_relevante"]),
});

export const accountSummarySchema = z.object({
  costBrl: z.number(),
  conversions: z.number(),
  clicks: z.number(),
  impressions: z.number(),
  costPerConversionBrl: z.number().nullable(),
});

export const analysisSchema = z.object({
  summary: accountSummarySchema,
  negativeKeywordRecommendations: z.array(negativeKeywordRecommendationSchema),
  lostImpressionShare: z.array(lostImpressionShareInsightSchema),
});

export const applyNegativeKeywordBodySchema = z.object({
  campaignId: z.string().min(1),
  term: z.string().min(1),
});
