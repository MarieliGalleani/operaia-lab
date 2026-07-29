import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { NotFoundError } from "@operaia/shared";
import {
  NEXO_OPERATIONAL_MISSION,
  type OperationalRuntime,
} from "./operational-composition.js";
import type { OperationalRun } from "./operational-run.js";
import {
  operationalRunIdParamsSchema,
  operationalRunResponseSchema,
  runMissionBodySchema,
} from "./operations.schema.js";

function toResponse(run: OperationalRun) {
  return {
    id: run.id,
    status: run.status,
    workspaceId: run.workspaceId,
    workspaceName: run.workspaceName,
    objective: run.objective,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    usableResult: run.usableResult,
    reply: {
      employeeId: run.reply.employeeId,
      content: run.reply.content,
      answer: {
        summary: run.reply.answer.summary,
        projects: [...run.reply.answer.projects],
        risks: [...run.reply.answer.risks],
        nextActions: [...run.reply.answer.nextActions],
      },
    },
    workflow: {
      workspaceId: run.workflow.workspaceId,
      title: run.workflow.title,
      steps: run.workflow.steps.map((step) => ({
        stage: step.stage,
        actorId: step.actorId,
        detail: step.detail,
        status: step.status,
        ...(step.timestamp !== undefined
          ? { timestamp: step.timestamp }
          : {}),
      })),
    },
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
    gaps: run.gaps.map((gap) => ({
      code: gap.code,
      severity: gap.severity,
      message: gap.message,
    })),
    ...(run.queueStatus ? { queueStatus: run.queueStatus } : {}),
  };
}

function statusCodeForRun(run: OperationalRun): 201 | 202 {
  return run.status === "completed" ? 201 : 202;
}

/**
 * Operacao assistida: missoes controladas com registro completo.
 * Controllers finos — delegam ao OperationalMissionService.
 * Path B (Queue) e o padrao de produto; Path A via kill-switch.
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
          response: {
            201: operationalRunResponseSchema,
            202: operationalRunResponseSchema,
          },
        },
      },
      async (request, reply) => {
        const run = await runtime.service.run({
          workspaceId: request.body.workspaceId,
          objective: request.body.objective,
          employeeId: request.body.employeeId,
        });
        return reply.status(statusCodeForRun(run)).send(toResponse(run));
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
          params: operationalRunIdParamsSchema,
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
          response: {
            201: operationalRunResponseSchema,
            202: operationalRunResponseSchema,
          },
        },
      },
      async (_request, reply) => {
        const run = await runtime.service.run({ ...NEXO_OPERATIONAL_MISSION });
        return reply.status(statusCodeForRun(run)).send(toResponse(run));
      },
    );
  };
}
