import { z } from "zod";

export const workspaceParamsSchema = z.object({
  workspaceId: z.string().min(1),
});

export const sessionParamsSchema = z.object({
  workspaceId: z.string().min(1),
  sessionId: z.string().min(1),
});

export const createSessionSchema = z.object({
  objective: z.string().min(1, "objetivo e obrigatorio"),
});

export const createSessionResponseSchema = z.object({
  sessionId: z.string(),
  status: z.string(),
  currentCycle: z.number(),
});

export const sessionStateResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  objective: z.string(),
  status: z.string(),
  currentCycle: z.number(),
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  executionSummary: z.unknown(),
  history: z.array(z.unknown()),
});
