import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { KnowledgeItemService } from "./application/knowledge-item.service.js";
import { PrismaKnowledgeItemRepository } from "./infrastructure/prisma-knowledge-item.repository.js";
import {
  createKnowledgeItemSchema,
  knowledgeItemParamsSchema,
  knowledgeItemResponseSchema,
  listKnowledgeItemsQuerySchema,
  updateKnowledgeItemSchema,
} from "./knowledge.schema.js";

/**
 * CRUD minimo de KnowledgeItem (P1.14B).
 * Isolamento por workspaceId obrigatorio em toda listagem — ver Parte 17.
 */
export const knowledgeRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new KnowledgeItemService(new PrismaKnowledgeItemRepository());

  app.post(
    "/",
    {
      schema: {
        tags: ["knowledge"],
        body: createKnowledgeItemSchema,
        response: { 201: knowledgeItemResponseSchema },
      },
    },
    async (request, reply) => {
      const item = await service.create(request.body);
      return reply.status(201).send(item);
    },
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["knowledge"],
        querystring: listKnowledgeItemsQuerySchema,
        response: { 200: z.array(knowledgeItemResponseSchema) },
      },
    },
    async (request) => service.listByWorkspace(request.query.workspaceId),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["knowledge"],
        params: knowledgeItemParamsSchema,
        response: { 200: knowledgeItemResponseSchema },
      },
    },
    async (request) => service.getById(request.params.id),
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["knowledge"],
        params: knowledgeItemParamsSchema,
        body: updateKnowledgeItemSchema,
        response: { 200: knowledgeItemResponseSchema },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["knowledge"],
        params: knowledgeItemParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.remove(request.params.id);
      return reply.status(204).send(null);
    },
  );
};
