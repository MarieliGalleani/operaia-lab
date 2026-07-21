import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ProjectService } from "./application/project.service.js";
import { PrismaProjectRepository } from "./infrastructure/prisma-project.repository.js";
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectParamsSchema,
  projectResponseSchema,
  updateProjectSchema,
} from "./projects.schema.js";
import { z } from "zod";

export const projectRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new ProjectService(new PrismaProjectRepository());

  app.post(
    "/",
    {
      schema: {
        tags: ["projects"],
        body: createProjectSchema,
        response: { 201: projectResponseSchema },
      },
    },
    async (request, reply) => {
      const project = await service.create(request.body);
      return reply.status(201).send(project);
    },
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["projects"],
        querystring: listProjectsQuerySchema,
        response: { 200: z.array(projectResponseSchema) },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["projects"],
        params: projectParamsSchema,
        response: { 200: projectResponseSchema },
      },
    },
    async (request) => service.getById(request.params.id),
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["projects"],
        params: projectParamsSchema,
        body: updateProjectSchema,
        response: { 200: projectResponseSchema },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["projects"],
        params: projectParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.remove(request.params.id);
      return reply.status(204).send(null);
    },
  );
};
