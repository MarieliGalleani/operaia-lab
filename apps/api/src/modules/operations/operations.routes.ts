import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { NotFoundError } from "@operaia/shared";
import {
  createOperationalRuntime,
  NEXO_OPERATIONAL_MISSION,
  type OperationalRuntime,
} from "./operational-composition.js";
import type { OperationalRun } from "./operational-run.js";

const runMissionBodySchema = z.object({
  workspaceId: z.string().min(1).default(NEXO_OPERATIONAL_MISSION.workspaceId),
  objective: z.string().min(1).default(NEXO_OPERATIONAL_MISSION.objective),
  employeeId: z.string().min(1).optional(),
});

const gapSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
});

const operationalRunResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  objective: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  usableResult: z.string(),
  reply: z.object({
    employeeId: z.string(),
    content: z.string(),
    answer: z.object({
      summary: z.string(),
      projects: z.array(z.string()),
      risks: z.array(z.string()),
      nextActions: z.array(z.string()),
    }),
  }),
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
});

function toResponse(run: OperationalRun) {
  return {
    id: run.id,
    workspaceId: run.workspaceId,
    workspaceName: run.workspaceName,
    objective: run.objective,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    usableResult: run.usableResult,
    reply: run.reply,
    workflow: run.workflow,
    decisions: {
      ceoAnalyzed: run.mission.initial.output.decision.analyzed,
      ceoDecision: run.mission.initial.output.decision.decision,
      delegations: run.mission.initial.output.decision.delegations.map(
        (item) => ({
          specialization: item.specialization,
          reason: item.reason,
          task: item.task,
        }),
      ),
    },
    specialists: run.mission.outcomes.map((outcome) => ({
      matched: outcome.matched,
      employeeId: outcome.employeeId,
      specialization: outcome.request.specialization,
      summary: outcome.result?.output.report.summary,
    })),
    llmEvents: [...run.llmEvents],
    gaps: run.gaps,
  };
}

/**
 * Operacao assistida: missoes controladas com registro completo.
 * Controllers finos — delegam ao OperationalMissionService.
 */
export function createOperationsRoutes(
  runtime: OperationalRuntime,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.post(
      "/missions",
      {
        schema: {
          tags: ["operations"],
          body: runMissionBodySchema,
          response: { 201: operationalRunResponseSchema },
        },
      },
      async (request, reply) => {
        const run = await runtime.service.run({
          workspaceId: request.body.workspaceId,
          objective: request.body.objective,
          employeeId: request.body.employeeId,
        });
        return reply.status(201).send(toResponse(run));
      },
    );

    app.get(
      "/missions",
      {
        schema: {
          tags: ["operations"],
          response: { 200: z.array(operationalRunResponseSchema) },
        },
      },
      async () => runtime.service.list().map(toResponse),
    );

    app.get(
      "/missions/:id",
      {
        schema: {
          tags: ["operations"],
          params: z.object({ id: z.string().min(1) }),
          response: { 200: operationalRunResponseSchema },
        },
      },
      async (request) => {
        const run = runtime.service.get(request.params.id);
        if (!run) {
          throw new NotFoundError("OperationalRun", request.params.id);
        }
        return toResponse(run);
      },
    );

    /** Atalho do primeiro ciclo NEXO. */
    app.post(
      "/missions/nexo",
      {
        schema: {
          tags: ["operations"],
          response: { 201: operationalRunResponseSchema },
        },
      },
      async (_request, reply) => {
        const run = await runtime.service.run({ ...NEXO_OPERATIONAL_MISSION });
        return reply.status(201).send(toResponse(run));
      },
    );
  };
}
