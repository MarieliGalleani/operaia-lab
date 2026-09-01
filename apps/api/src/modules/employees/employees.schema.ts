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
 * Schemas de resposta usam arrays mutaveis (`string[]`) alinhados aos DTOs HTTP.
 * Colecoes internas readonly sao copiadas na construcao do DTO (`[...arr]`).
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
  capabilities: z.array(z.string()),
  permissions: z.array(z.string()),
  limits: z.array(z.string()),
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
    projects: z.array(z.string()),
    risks: z.array(z.string()),
    nextActions: z.array(z.string()),
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
  steps: z.array(workflowStepSchema),
});

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  objective: z.string(),
  status: z.string(),
  progress: z.number(),
  teamIds: z.array(z.string()),
  decisions: z.array(
    z.object({
      id: z.string(),
      summary: z.string(),
      authorId: z.string(),
      date: z.string(),
    }),
  ),
  /// P1.14B — contexto operacional real do Project (distinto de `objective`).
  projectObjective: z.string().nullable(),
  projectContext: z.string().nullable(),
  projectConstraints: z.string().nullable(),
});

export const workspaceTaskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  status: z.enum(["BACKLOG", "IN_PROGRESS", "DONE"]),
  assigneeId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
});
