import { z } from "zod";

export const runMissionBodySchema = z.object({
  workspaceId: z.string().min(1),
  objective: z.string().min(1),
  employeeId: z.string().min(1).optional(),
});

export const operationalRunIdParamsSchema = z.object({
  id: z.string().min(1),
});

const gapSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
});

const replySchema = z.object({
  employeeId: z.string(),
  content: z.string(),
  answer: z.object({
    summary: z.string(),
    projects: z.array(z.string()),
    risks: z.array(z.string()),
    nextActions: z.array(z.string()),
  }),
});

/**
 * Contrato HTTP de OperationalRun (Unified Mission Gateway Fase 1).
 * status completed | in_progress | timed_out — id = Mission Queue id no Path B.
 * Arrays mutaveis alinhados aos DTOs de reply/workflow.
 */
export const operationalRunResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["completed", "in_progress", "timed_out"]),
  workspaceId: z.string(),
  workspaceName: z.string(),
  objective: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  usableResult: z.string(),
  reply: replySchema,
  workflow: z.object({
    workspaceId: z.string(),
    title: z.string(),
    steps: z.array(
      z.object({
        stage: z.string(),
        actorId: z.string(),
        detail: z.string(),
        status: z.string(),
        timestamp: z.string().optional(),
      }),
    ),
  }),
  decisions: z.object({
    ceoAnalyzed: z.string(),
    ceoDecision: z.string(),
    delegations: z.array(
      z.object({
        specialization: z.string(),
        reason: z.string(),
        task: z.string().optional(),
      }),
    ),
  }),
  specialists: z.array(
    z.object({
      matched: z.boolean(),
      employeeId: z.string().optional(),
      specialization: z.string(),
      summary: z.string().optional(),
    }),
  ),
  llmEvents: z.array(z.unknown()),
  gaps: z.array(gapSchema),
  queueStatus: z.string().optional(),
});
