import { z } from "zod";

export const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(160),
  description: z.string().max(2000).nullish(),
  systemInstructions: z.string().min(1),
  active: z.boolean().optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullish(),
  systemInstructions: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const agentParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listAgentsQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export const agentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.string(),
  description: z.string().nullable(),
  systemInstructions: z.string(),
  active: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
