import { z } from "zod";

export const scheduleRuleSchema = z.object({
  id: z.string(),
  workspaceId: z.string().nullable(),
  workspaceName: z.string().nullable(),
  intervalSec: z.number().int().positive(),
  enabled: z.boolean(),
  objective: z.string().nullable(),
  lastEnqueuedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createScheduleRuleBodySchema = z.object({
  workspaceId: z.string().min(1),
  objective: z.string().min(1),
  intervalSec: z.number().int().min(60).max(86_400),
  enabled: z.boolean().optional(),
});

export const updateScheduleRuleBodySchema = z.object({
  objective: z.string().min(1).optional(),
  intervalSec: z.number().int().min(60).max(86_400).optional(),
  enabled: z.boolean().optional(),
});

export const scheduleRuleParamsSchema = z.object({ id: z.string().min(1) });

export const deleteScheduleRuleResponseSchema = z.object({
  deleted: z.literal(true),
});
