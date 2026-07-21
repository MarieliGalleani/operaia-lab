import {
  createWorkspaceRuntime,
  type Workspace,
} from "@operaia/workspace-runtime";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  createSessionResponseSchema,
  createSessionSchema,
  sessionParamsSchema,
  sessionStateResponseSchema,
  workspaceParamsSchema,
} from "./workspaces.schema.js";

/**
 * Workspaces disponiveis nesta sprint. Representam projetos vivos e vivem no
 * store em memoria do Workspace Runtime. A persistencia real (PostgreSQL)
 * chega no Tool Connector Layer.
 */
function seedWorkspaces(): Workspace[] {
  const createdAt = new Date();
  return [
    { id: "nexo", name: "NEXO", createdAt },
    { id: "menuflow", name: "MenuFlow", createdAt },
    { id: "plataforma", name: "Plataforma", createdAt },
  ];
}

export const workspaceRoutes: FastifyPluginAsyncZod = async (app) => {
  const { manager } = createWorkspaceRuntime({
    initialWorkspaces: seedWorkspaces(),
  });

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
