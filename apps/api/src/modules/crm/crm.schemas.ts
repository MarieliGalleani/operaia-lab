import { z } from "zod";

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

export const clientMetricKindSchema = z.enum(["TRAFEGO", "PERFORMANCE", "AUTOMACAO"]);

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
