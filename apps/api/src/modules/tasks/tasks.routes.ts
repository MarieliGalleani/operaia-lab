import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { TaskService } from "./application/task.service.js";
import { PrismaTaskRepository } from "./infrastructure/prisma-task.repository.js";
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskParamsSchema,
  taskResponseSchema,
  updateTaskSchema,
} from "./tasks.schema.js";

export const taskRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = new TaskService(new PrismaTaskRepository());

  app.post(
    "/",
    {
      schema: {
        tags: ["tasks"],
        body: createTaskSchema,
        response: { 201: taskResponseSchema },
      },
    },
    async (request, reply) => {
      const task = await service.create(request.body);
      return reply.status(201).send(task);
    },
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["tasks"],
        querystring: listTasksQuerySchema,
        response: { 200: z.array(taskResponseSchema) },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["tasks"],
        params: taskParamsSchema,
        response: { 200: taskResponseSchema },
      },
    },
    async (request) => service.getById(request.params.id),
  );

  app.patch(
    "/:id",
    {
      schema: {
        tags: ["tasks"],
        params: taskParamsSchema,
        body: updateTaskSchema,
        response: { 200: taskResponseSchema },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["tasks"],
        params: taskParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await service.remove(request.params.id);
      return reply.status(204).send(null);
    },
  );
};
