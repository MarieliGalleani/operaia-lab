import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  clientSummarySchema,
  createCampaignBodySchema,
  marketingAttachmentSchema,
  marketingCampaignSchema,
  nicheSummarySchema,
} from "./marketing-office.schemas.js";
import {
  createCampaign,
  getCampaignAttachment,
  getCampaignById,
  listCampaigns,
  listClients,
  listNiches,
  toApiCampaign,
} from "./marketing-campaign.service.js";

export const createMarketingOfficeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/office/marketing/campaigns",
    {
      schema: {
        tags: ["marketing-office"],
        response: { 200: z.array(marketingCampaignSchema) },
      },
    },
    async () => {
      const campaigns = await listCampaigns();
      return JSON.parse(JSON.stringify(campaigns.map(toApiCampaign)));
    },
  );

  app.post(
    "/office/marketing/campaigns",
    {
      schema: {
        tags: ["marketing-office"],
        body: createCampaignBodySchema,
        response: { 200: marketingCampaignSchema },
      },
    },
    async (request) => {
      const campaign = await createCampaign(request.body);
      return JSON.parse(JSON.stringify(toApiCampaign(campaign)));
    },
  );

  app.get(
    "/office/marketing/campaigns/:id",
    {
      schema: {
        tags: ["marketing-office"],
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: marketingCampaignSchema,
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const campaign = await getCampaignById(request.params.id);
      if (!campaign) {
        return reply.status(404).send({ message: "Campanha nao encontrada." });
      }
      return JSON.parse(JSON.stringify(toApiCampaign(campaign)));
    },
  );

  app.get(
    "/office/marketing/niches",
    {
      schema: {
        tags: ["marketing-office"],
        response: { 200: z.array(nicheSummarySchema) },
      },
    },
    async () => {
      const niches = await listNiches();
      return JSON.parse(JSON.stringify(niches));
    },
  );

  app.get(
    "/office/marketing/clients",
    {
      schema: {
        tags: ["marketing-office"],
        response: { 200: z.array(clientSummarySchema) },
      },
    },
    async () => {
      const clients = await listClients();
      return JSON.parse(JSON.stringify(clients));
    },
  );

  app.get(
    "/office/marketing/campaigns/:id/attachment",
    {
      schema: {
        tags: ["marketing-office"],
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: marketingAttachmentSchema,
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const attachment = await getCampaignAttachment(request.params.id);
      if (!attachment) {
        return reply.status(404).send({ message: "Anexo nao encontrado." });
      }
      return attachment;
    },
  );
};
