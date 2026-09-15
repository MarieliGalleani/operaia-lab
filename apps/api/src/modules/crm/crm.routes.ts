import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  ClientAlreadyExistsError,
  createClient,
  getClientsOverview,
  listClients,
  listNiches,
  updateClient,
} from "./niche-client.service.js";
import { createMetricEntry, deleteMetricEntry, listMetricEntries } from "./client-metrics.service.js";
import { createPayment, deletePayment, listPayments } from "./client-payments.service.js";
import {
  clientPaymentSchema,
  clientSummarySchema,
  clientsOverviewSchema,
  createClientBodySchema,
  createMetricEntryBodySchema,
  createPaymentBodySchema,
  metricEntrySchema,
  nicheSummarySchema,
  updateClientBodySchema,
} from "./crm.schemas.js";

/**
 * Nicho/Cliente (P1.X Fases 1, 3, 7 e Carteira) — rotas neutras, usadas por
 * QUALQUER andar com pipeline por cliente (Marketing, Automacao, e o que
 * vier depois). O Marketing tambem expoe as mesmas listas sob
 * /office/marketing/* por compatibilidade com a tela existente — ambas leem
 * os mesmos dados.
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
    "/office/clients/overview",
    {
      schema: {
        tags: ["crm"],
        response: { 200: clientsOverviewSchema },
      },
    },
    async () => {
      const overview = await getClientsOverview();
      return JSON.parse(JSON.stringify(overview));
    },
  );

  app.post(
    "/office/clients",
    {
      schema: {
        tags: ["crm"],
        body: createClientBodySchema,
        response: {
          200: clientSummarySchema,
          409: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const client = await createClient(request.body);
        return JSON.parse(JSON.stringify(client));
      } catch (error) {
        if (error instanceof ClientAlreadyExistsError) {
          return reply.status(409).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  app.patch(
    "/office/clients/:id",
    {
      schema: {
        tags: ["crm"],
        params: z.object({ id: z.string().min(1) }),
        body: updateClientBodySchema,
        response: { 200: clientSummarySchema },
      },
    },
    async (request) => {
      const client = await updateClient(request.params.id, request.body);
      return JSON.parse(JSON.stringify(client));
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

  app.get(
    "/office/clients/:id/payments",
    {
      schema: {
        tags: ["crm"],
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.array(clientPaymentSchema) },
      },
    },
    async (request) => {
      const payments = await listPayments(request.params.id);
      return JSON.parse(JSON.stringify(payments));
    },
  );

  app.post(
    "/office/clients/:id/payments",
    {
      schema: {
        tags: ["crm"],
        params: z.object({ id: z.string().min(1) }),
        body: createPaymentBodySchema,
        response: { 200: clientPaymentSchema },
      },
    },
    async (request) => {
      const payment = await createPayment({ clientId: request.params.id, ...request.body });
      return JSON.parse(JSON.stringify(payment));
    },
  );

  app.delete(
    "/office/payments/:id",
    {
      schema: {
        tags: ["crm"],
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request) => {
      await deletePayment(request.params.id);
      return { ok: true };
    },
  );
};
