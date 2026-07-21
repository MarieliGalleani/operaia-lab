import { Priority, ProjectStatus } from "@operaia/shared";
import { z } from "zod";

const projectStatusSchema = z.nativeEnum(ProjectStatus);
const prioritySchema = z.nativeEnum(Priority);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  status: projectStatusSchema.optional(),
  priority: prioritySchema.optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const projectParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listProjectsQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export const projectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  priority: prioritySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
