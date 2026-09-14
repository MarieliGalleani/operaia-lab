import { z } from "zod";

export const automationStageIdSchema = z.enum([
  "DIAGNOSTICO",
  "MAPA_PROCESSOS",
  "AUTOMACOES_RECOMENDADAS",
  "ARQUITETURA_INTEGRACAO",
  "PLANO_IMPLEMENTACAO",
  "PLAYBOOK_OPERACIONAL",
  "FRAMEWORK_MONITORAMENTO",
]);

export const automationEngagementStatusSchema = z.enum(["PENDING", "RUNNING", "DONE", "ERROR"]);

export const automationEngagementSchema = z.object({
  id: z.string(),
  niche: z.string(),
  nicheId: z.string(),
  briefing: z.string(),
  status: automationEngagementStatusSchema,
  currentStage: automationStageIdSchema.nullable(),
  diagnostico: z.string().nullable(),
  mapaProcessos: z.string().nullable(),
  automacoesRecomendadas: z.string().nullable(),
  arquiteturaIntegracao: z.string().nullable(),
  planoImplementacao: z.string().nullable(),
  playbookOperacional: z.string().nullable(),
  frameworkMonitoramento: z.string().nullable(),
  attachmentName: z.string().nullable(),
  attachmentMimeType: z.string().nullable(),
  errorMessage: z.string().nullable(),
  fallbackStages: z.array(automationStageIdSchema),
  clientName: z.string().nullable(),
  totalDurationMs: z.number().nullable(),
  reuseRatio: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** ~4.5MB de arquivo original (base64 tem overhead de ~33%). */
const MAX_ATTACHMENT_BASE64_LENGTH = 6_000_000;

export const createEngagementBodySchema = z.object({
  niche: z.string().min(2).max(160),
  briefing: z.string().min(10).max(4000),
  clientName: z.string().min(1).max(160).optional(),
  attachmentName: z.string().max(200).optional(),
  attachmentMimeType: z.string().max(100).optional(),
  attachmentBase64: z.string().max(MAX_ATTACHMENT_BASE64_LENGTH).optional(),
});

export const automationAttachmentSchema = z.object({
  name: z.string(),
  mimeType: z.string(),
  base64: z.string(),
});

export const automationClientPlansSchema = z.object({
  frameworkMonitoramento: z.string().nullable(),
});
