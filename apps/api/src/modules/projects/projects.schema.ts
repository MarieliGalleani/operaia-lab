import { Priority, ProjectStatus } from "@operaia/shared";
import { z } from "zod";

const projectStatusSchema = z.nativeEnum(ProjectStatus);
const prioritySchema = z.nativeEnum(Priority);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  status: projectStatusSchema.optional(),
  priority: prioritySchema.optional(),
  /// P1.14B — contexto operacional, todos opcionais, sem valor ficticio.
  objective: z.string().max(2000).nullish(),
  context: z.string().max(4000).nullish(),
  constraints: z.string().max(2000).nullish(),
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
  objective: z.string().nullable(),
  context: z.string().nullable(),
  constraints: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
