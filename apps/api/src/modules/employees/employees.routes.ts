import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { EmployeesApplication } from "./employees.application.js";
import {
  askEmployeeBodySchema,
  employeeIdParamsSchema,
  employeeProfileSchema,
  employeeReplySchema,
  employeeStatusSchema,
  httpErrorSchema,
} from "./employees.schema.js";

/**
 * Rotas HTTP da Equipe Digital. Controllers apenas delegam a
 * EmployeesApplication — zero regra de negocio de funcionarios.
 */
export function createEmployeeRoutes(
  application: EmployeesApplication,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      "/",
      {
        schema: {
          tags: ["employees"],
          response: { 200: z.array(employeeProfileSchema).readonly() },
        },
      },
      async () => application.listProfiles(),
    );

    app.get(
      "/statuses",
      {
        schema: {
          tags: ["employees"],
          response: { 200: z.array(employeeStatusSchema).readonly() },
        },
      },
      async () => application.listStatuses(),
    );

    app.get(
      "/:id",
      {
        schema: {
          tags: ["employees"],
          params: employeeIdParamsSchema,
          response: {
            200: employeeProfileSchema,
            404: httpErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const profile = application.getProfile(request.params.id);
        if (!profile) {
          return reply.status(404).send({
            code: "NOT_FOUND",
            message: `Employee nao encontrado: ${request.params.id}`,
          });
        }
        return profile;
      },
    );

    app.post(
      "/:id/ask",
      {
        schema: {
          tags: ["employees"],
          params: employeeIdParamsSchema,
          body: askEmployeeBodySchema,
          response: { 200: employeeReplySchema },
        },
      },
      async (request) => {
        const { reply } = await application.ask({
          employeeId: request.params.id,
          workspaceId: request.body.workspaceId,
          question: request.body.question,
        });
        return reply;
      },
    );
  };
}
