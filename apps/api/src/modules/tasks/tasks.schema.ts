import { Priority, TaskStatus } from "@operaia/shared";
import { z } from "zod";

const taskStatusSchema = z.nativeEnum(TaskStatus);
const prioritySchema = z.nativeEnum(Priority);

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(160),
  description: z.string().max(4000).nullish(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  assignedAgentId: z.string().uuid().nullish(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).nullish(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  assignedAgentId: z.string().uuid().nullish(),
});

export const taskParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listTasksQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: taskStatusSchema.optional(),
  assignedAgentId: z.string().uuid().optional(),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export const taskResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: prioritySchema,
  assignedAgentId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
