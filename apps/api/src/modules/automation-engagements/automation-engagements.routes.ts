import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  automationAttachmentSchema,
  automationClientPlansSchema,
  automationEngagementSchema,
  createEngagementBodySchema,
} from "./automation-office.schemas.js";
import {
  createEngagement,
  getClientLatestAutomationPlans,
  getEngagementAttachment,
  getEngagementById,
  listEngagements,
  toApiEngagement,
} from "./automation-engagement.service.js";

export const createAutomationEngagementRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/office/automation-engagements",
    {
      schema: {
        tags: ["automation-engagements"],
        response: { 200: z.array(automationEngagementSchema) },
      },
    },
    async () => {
      const engagements = await listEngagements();
      return JSON.parse(JSON.stringify(engagements.map(toApiEngagement)));
    },
  );

  app.post(
    "/office/automation-engagements",
    {
      schema: {
        tags: ["automation-engagements"],
        body: createEngagementBodySchema,
        response: { 200: automationEngagementSchema },
      },
    },
    async (request) => {
      const engagement = await createEngagement(request.body);
      return JSON.parse(JSON.stringify(toApiEngagement(engagement)));
    },
  );

  app.get(
    "/office/automation-engagements/:id",
    {
      schema: {
        tags: ["automation-engagements"],
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: automationEngagementSchema,
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const engagement = await getEngagementById(request.params.id);
      if (!engagement) {
        return reply.status(404).send({ message: "Engajamento nao encontrado." });
      }
      return JSON.parse(JSON.stringify(toApiEngagement(engagement)));
    },
  );

  app.get(
    "/office/automation-engagements/clients/:id/plans",
    {
      schema: {
        tags: ["automation-engagements"],
        params: z.object({ id: z.string().min(1) }),
        response: { 200: automationClientPlansSchema },
      },
    },
    async (request) => {
      return getClientLatestAutomationPlans(request.params.id);
    },
  );

  app.get(
    "/office/automation-engagements/:id/attachment",
    {
      schema: {
        tags: ["automation-engagements"],
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: automationAttachmentSchema,
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const attachment = await getEngagementAttachment(request.params.id);
      if (!attachment) {
        return reply.status(404).send({ message: "Anexo nao encontrado." });
      }
      return attachment;
    },
  );
};
