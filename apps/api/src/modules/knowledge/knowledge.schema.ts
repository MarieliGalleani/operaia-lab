import { z } from "zod";

export const knowledgeItemTypeSchema = z.enum(["NOTE", "DOCUMENT", "LINK"]);

export const createKnowledgeItemSchema = z.object({
  workspaceId: z.string().min(1),
  type: knowledgeItemTypeSchema.optional(),
  title: z.string().min(1).max(200),
  content: z.string().max(20_000).nullish(),
});

export const updateKnowledgeItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(20_000).nullish(),
});

export const knowledgeItemParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listKnowledgeItemsQuerySchema = z.object({
  workspaceId: z.string().min(1),
});

export const knowledgeItemResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string(),
  type: knowledgeItemTypeSchema,
  title: z.string(),
  content: z.string().nullable(),
  fileRef: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
