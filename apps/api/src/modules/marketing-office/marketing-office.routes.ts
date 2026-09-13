import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  createCampaignBodySchema,
  marketingCampaignSchema,
} from "./marketing-office.schemas.js";
import {
  createCampaign,
  getCampaignById,
  listCampaigns,
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
      return JSON.parse(JSON.stringify(campaigns));
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
      return JSON.parse(JSON.stringify(campaign));
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
      return JSON.parse(JSON.stringify(campaign));
    },
  );
};
