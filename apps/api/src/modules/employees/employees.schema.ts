import { z } from "zod";

/** Erro HTTP tipado na borda (ex.: reply.status(404).send). */
export const httpErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const employeeIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().min(1),
});

export const askEmployeeBodySchema = z.object({
  workspaceId: z.string().min(1),
  question: z.string().min(1),
});

/**
 * Schemas de resposta usam `.readonly()` nos arrays para alinhar ao DTO interno
 * (`readonly T[]`). Zod + Fastify passam a aceitar o retorno sem cast.
 */
export const employeeProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  specialization: z.string(),
  status: z.enum(["WORKING", "AVAILABLE", "HIRING"]),
  version: z.string(),
  executable: z.literal(true),
  mission: z.string(),
  capabilities: z.array(z.string()).readonly(),
  permissions: z.array(z.string()).readonly(),
  limits: z.array(z.string()).readonly(),
});

export const employeeStatusSchema = z.object({
  employeeId: z.string(),
  status: z.enum(["WORKING", "AVAILABLE", "HIRING"]),
  statusLabel: z.string(),
  lastActivity: z.string(),
});

export const employeeReplySchema = z.object({
  employeeId: z.string(),
  content: z.string(),
  answer: z.object({
    summary: z.string(),
    projects: z.array(z.string()).readonly(),
    risks: z.array(z.string()).readonly(),
    nextActions: z.array(z.string()).readonly(),
  }),
});

export const workflowStepSchema = z.object({
  stage: z.enum([
    "THINKING",
    "ANALYZING",
    "DELEGATING",
    "EXECUTING",
    "REVIEWING",
    "DONE",
  ]),
  actorId: z.string(),
  detail: z.string(),
  status: z.enum(["done", "current", "pending"]),
  timestamp: z.string().optional(),
});

export const workflowSchema = z.object({
  workspaceId: z.string(),
  title: z.string(),
  steps: z.array(workflowStepSchema).readonly(),
});

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string(),
  status: z.string(),
  progress: z.number(),
  teamIds: z.array(z.string()).readonly(),
  decisions: z
    .array(
      z.object({
        id: z.string(),
        summary: z.string(),
        authorId: z.string(),
        date: z.string(),
      }),
    )
    .readonly(),
});

export const workspaceTaskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  status: z.enum(["BACKLOG", "IN_PROGRESS", "DONE"]),
  assigneeId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
});
