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
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  setupPaid: z.boolean(),
  recurringActive: z.boolean(),
  active: z.boolean(),
  createdAt: z.string(),
});

export const createClientBodySchema = z.object({
  nicheName: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  contactName: z.string().max(160).optional(),
  contactEmail: z.string().max(160).optional(),
  contactPhone: z.string().max(60).optional(),
});

export const updateClientBodySchema = z.object({
  name: z.string().min(1).max(160).optional(),
  contactName: z.string().max(160).nullable().optional(),
  contactEmail: z.string().max(160).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  setupPaid: z.boolean().optional(),
  recurringActive: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const clientPaymentKindSchema = z.enum(["SETUP", "RECORRENTE"]);

export const clientPaymentSchema = z.object({
  id: z.string(),
  kind: clientPaymentKindSchema,
  amountBrl: z.number(),
  paidAt: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export const createPaymentBodySchema = z.object({
  kind: clientPaymentKindSchema,
  amountBrl: z.number().positive(),
  paidAt: z.string().min(1),
  note: z.string().max(500).optional(),
});

export const staleClientSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  daysSinceActivity: z.number(),
});

export const clientsOverviewSchema = z.object({
  totalClients: z.number(),
  activeClients: z.number(),
  setupPendingCount: z.number(),
  recurringActiveCount: z.number(),
  estimatedMrrBrl: z.number(),
  staleClients: z.array(staleClientSchema),
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
