import {
  createWorkspaceRuntime,
} from "@operaia/workspace-runtime";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { EmployeesApplication } from "../employees/employees.application.js";
import {
  httpErrorSchema,
  workspaceSchema,
  workspaceTaskSchema,
  workflowSchema,
} from "../employees/employees.schema.js";
import {
  createSessionResponseSchema,
  createSessionSchema,
  sessionParamsSchema,
  sessionStateResponseSchema,
  workspaceParamsSchema,
} from "./workspaces.schema.js";

/**
 * Workspaces: catalogo real (Project/Task via Equipe Digital) + sessoes Runtime.
 * Session store espelha o catalogo multi-workspace (sem seed fixo NEXO).
 */
export function createWorkspaceRoutes(
  application: EmployeesApplication,
): FastifyPluginAsyncZod {
  return async (app) => {
    const catalog = await application.listWorkspaces();
    const { manager, workspaceStore } = createWorkspaceRuntime({
      initialWorkspaces: catalog.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        createdAt: new Date(),
      })),
    });

    app.get(
      "/",
      {
        schema: {
          tags: ["workspaces"],
          response: { 200: z.array(workspaceSchema) },
        },
      },
      async () =>
        (await application.listWorkspaces()).map((workspace) => ({
          ...workspace,
          teamIds: [...workspace.teamIds],
          decisions: workspace.decisions.map((decision) => ({ ...decision })),
        })),
    );

    app.get(
      "/:workspaceId",
      {
        schema: {
          tags: ["workspaces"],
          params: workspaceParamsSchema,
          response: {
            200: workspaceSchema,
            404: httpErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const workspace = await application.getWorkspace(
          request.params.workspaceId,
        );
        if (!workspace) {
          return reply.code(404).send({
            code: "NOT_FOUND",
            message: `Workspace nao encontrado: ${request.params.workspaceId}`,
          });
        }
        return reply.code(200).send({
          ...workspace,
          teamIds: [...workspace.teamIds],
          decisions: workspace.decisions.map((decision) => ({ ...decision })),
        });
      },
    );

    app.get(
      "/:workspaceId/tasks",
      {
        schema: {
          tags: ["workspaces"],
          params: workspaceParamsSchema,
          response: { 200: z.array(workspaceTaskSchema) },
        },
      },
      async (request) => application.listTasks(request.params.workspaceId),
    );

    app.get(
      "/:workspaceId/workflow",
      {
        schema: {
          tags: ["workspaces"],
          params: workspaceParamsSchema,
          response: {
            200: workflowSchema,
            404: httpErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const workflow = application.getWorkflow(request.params.workspaceId);
        if (!workflow) {
          return reply.code(404).send({
            code: "NOT_FOUND",
            message: `Workflow nao encontrado: ${request.params.workspaceId}`,
          });
        }
        return reply.code(200).send({
          workspaceId: workflow.workspaceId,
          title: workflow.title,
          steps: workflow.steps.map((step) => ({ ...step })),
        });
      },
    );

    app.get(
      "/:workspaceId/events",
      {
        schema: {
          tags: ["workspaces"],
          params: workspaceParamsSchema,
          response: { 200: z.array(z.unknown()) },
        },
      },
      async () => [],
    );

    app.post(
      "/:workspaceId/sessions",
      {
        schema: {
          tags: ["workspaces"],
          params: workspaceParamsSchema,
          body: createSessionSchema,
          response: {
            201: createSessionResponseSchema,
            404: httpErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const officeWorkspace = await application.getWorkspace(
          request.params.workspaceId,
        );
        if (!officeWorkspace) {
          return reply.code(404).send({
            code: "NOT_FOUND",
            message: `Workspace nao encontrado: ${request.params.workspaceId}`,
          });
        }
        // Registra dinamicamente no WorkspaceRuntime (multi-workspace).
        await workspaceStore.save({
          id: officeWorkspace.id,
          name: officeWorkspace.name,
          createdAt: new Date(),
        });
        const session = await manager.startSession({
          workspaceId: officeWorkspace.id,
          objective: request.body.objective,
        });
        return reply.status(201).send({
          sessionId: session.id,
          status: session.status,
          currentCycle: session.currentCycle,
        });
      },
    );

    app.get(
      "/:workspaceId/sessions/:sessionId",
      {
        schema: {
          tags: ["workspaces"],
          params: sessionParamsSchema,
          response: { 200: sessionStateResponseSchema },
        },
      },
      async (request) => {
        const session = await manager.getSession(
          request.params.workspaceId,
          request.params.sessionId,
        );
        return {
          id: session.id,
          workspaceId: session.workspaceId,
          objective: session.objective,
          status: session.status,
          currentCycle: session.currentCycle,
          startedAt: session.startedAt,
          finishedAt: session.finishedAt,
          executionSummary: session.executionSummary,
          history: [...session.history],
        };
      },
    );
  };
}
