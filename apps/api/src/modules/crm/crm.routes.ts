import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { listClients, listNiches } from "./niche-client.service.js";
import { createMetricEntry, deleteMetricEntry, listMetricEntries } from "./client-metrics.service.js";
import {
  clientSummarySchema,
  createMetricEntryBodySchema,
  metricEntrySchema,
  nicheSummarySchema,
} from "./crm.schemas.js";

/**
 * Nicho/Cliente (P1.X Fases 1, 3 e 7) — rotas neutras, usadas por QUALQUER
 * andar com pipeline por cliente (Marketing, Automacao, e o que vier
 * depois). O Marketing tambem expoe as mesmas listas sob /office/marketing/*
 * por compatibilidade com a tela existente — ambas leem os mesmos dados.
 */
export const createCrmRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/office/niches",
    {
      schema: {
        tags: ["crm"],
        response: { 200: z.array(nicheSummarySchema) },
      },
    },
    async () => {
      const niches = await listNiches();
      return JSON.parse(JSON.stringify(niches));
    },
  );

  app.get(
    "/office/clients",
    {
      schema: {
        tags: ["crm"],
        response: { 200: z.array(clientSummarySchema) },
      },
    },
    async () => {
      const clients = await listClients();
      return JSON.parse(JSON.stringify(clients));
    },
  );

  app.get(
    "/office/clients/:id/metrics",
    {
      schema: {
        tags: ["crm"],
        params: z.object({ id: z.string().min(1) }),
        querystring: z.object({ kind: z.enum(["TRAFEGO", "PERFORMANCE", "AUTOMACAO"]) }),
        response: { 200: z.array(metricEntrySchema) },
      },
    },
    async (request) => {
      const entries = await listMetricEntries(request.params.id, request.query.kind);
      return JSON.parse(JSON.stringify(entries));
    },
  );

  app.post(
    "/office/clients/:id/metrics",
    {
      schema: {
        tags: ["crm"],
        params: z.object({ id: z.string().min(1) }),
        body: createMetricEntryBodySchema,
        response: { 200: metricEntrySchema },
      },
    },
    async (request) => {
      const entry = await createMetricEntry({ clientId: request.params.id, ...request.body });
      return JSON.parse(JSON.stringify(entry));
    },
  );

  app.delete(
    "/office/metrics/:id",
    {
      schema: {
        tags: ["crm"],
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request) => {
      await deleteMetricEntry(request.params.id);
      return { ok: true };
    },
  );
};
