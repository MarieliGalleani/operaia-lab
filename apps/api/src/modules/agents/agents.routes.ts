import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { AgentService } from "./application/agent.service.js";
import { PrismaAgentRepository } from "./infrastructure/prisma-agent.repository.js";
import {
  agentParamsSchema,
  agentResponseSchema,
  createAgentSchema,
  listAgentsQuerySchema,
  updateAgentSchema,
} from "./agents.schema.js";

export const agentRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new AgentService(new PrismaAgentRepository());

  app.post(
    "/",
    {
      schema: {
        tags: ["agents"],
        body: createAgentSchema,
        response: { 201: agentResponseSchema },
      },
    },
    async (request, reply) => {
      const agent = await service.create(request.body);
      return reply.status(201).send(agent);
    },
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["agents"],
        querystring: listAgentsQuerySchema,
        response: { 200: z.array(agentResponseSchema) },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["agents"],
        params: agentParamsSchema,
        response: { 200: agentResponseSchema },
      },
    },
    async (request) => service.getById(request.params.id),
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["agents"],
        params: agentParamsSchema,
        body: updateAgentSchema,
        response: { 200: agentResponseSchema },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["agents"],
        params: agentParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.remove(request.params.id);
      return reply.status(204).send(null);
    },
  );
};
