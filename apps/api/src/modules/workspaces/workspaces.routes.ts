import {
  createWorkspaceRuntime,
  type Workspace,
} from "@operaia/workspace-runtime";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { EmployeesApplication } from "../employees/employees.application.js";
import {
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

function seedSessionWorkspaces(): Workspace[] {
  const createdAt = new Date();
  return [
    { id: "nexo", name: "NEXO", createdAt },
    { id: "menuflow", name: "MenuFlow", createdAt },
    { id: "plataforma", name: "Plataforma", createdAt },
  ];
}

/**
 * Workspaces: catalogo real (Project/Task via Equipe Digital) + sessoes Runtime.
 */
export function createWorkspaceRoutes(
  application: EmployeesApplication,
): FastifyPluginAsyncZod {
  return async (app) => {
    const { manager } = createWorkspaceRuntime({
      initialWorkspaces: seedSessionWorkspaces(),
    });

    app.get(
      "/",
      {
        schema: {
          tags: ["workspaces"],
          response: { 200: z.array(workspaceSchema) },
        },
      },
      async () => application.listWorkspaces(),
    );

    app.get(
      "/:workspaceId",
      {
        schema: {
          tags: ["workspaces"],
          params: workspaceParamsSchema,
          response: { 200: workspaceSchema },
        },
      },
      async (request, reply) => {
        const workspace = await application.getWorkspace(
          request.params.workspaceId,
        );
        if (!workspace) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: `Workspace nao encontrado: ${request.params.workspaceId}`,
          });
        }
        return workspace;
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
          response: { 200: workflowSchema },
        },
      },
      async (request, reply) => {
        const workflow = application.getWorkflow(request.params.workspaceId);
        if (!workflow) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: `Workflow nao encontrado: ${request.params.workspaceId}`,
          });
        }
        return workflow;
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
          response: { 201: createSessionResponseSchema },
        },
      },
      async (request, reply) => {
        const session = await manager.startSession({
          workspaceId: request.params.workspaceId,
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
