import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { isGoogleAdsConfigured } from "./google-ads-config.js";
import { buildAuthUrl, decodeState, exchangeCodeForRefreshToken } from "./google-ads-oauth.service.js";
import {
  disconnectClient,
  getConnectionStatus,
  saveConnection,
} from "./google-ads-connection.service.js";
import { applyNegativeKeyword, runAnalysis } from "./google-ads-analysis.service.js";
import {
  analysisSchema,
  applyNegativeKeywordBodySchema,
  connectQuerySchema,
  connectionStatusSchema,
} from "./google-ads.schemas.js";

/** Pra onde o usuario volta depois do consentimento OAuth do Google. */
const FRONTEND_RETURN_URL = "https://lab.operaia.com.br/app/floor/marketing/work";

export const createGoogleAdsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/office/google-ads/clients/:id/status",
    {
      schema: {
        tags: ["google-ads"],
        params: z.object({ id: z.string().min(1) }),
        response: { 200: connectionStatusSchema },
      },
    },
    async (request) => {
      return getConnectionStatus(request.params.id, isGoogleAdsConfigured());
    },
  );

  app.get(
    "/office/google-ads/clients/:id/connect",
    {
      schema: {
        tags: ["google-ads"],
        params: z.object({ id: z.string().min(1) }),
        querystring: connectQuerySchema,
        response: {
          302: z.void(),
          409: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!isGoogleAdsConfigured()) {
        return reply
          .status(409)
          .send({ message: "Google Ads ainda não foi configurado nesta instância (faltam credenciais da aplicação)." });
      }
      const url = buildAuthUrl({
        clientId: request.params.id,
        customerId: request.query.customerId,
        loginCustomerId: request.query.loginCustomerId,
      });
      return reply.redirect(url);
    },
  );

  app.post(
    "/office/google-ads/clients/:id/disconnect",
    {
      schema: {
        tags: ["google-ads"],
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request) => {
      await disconnectClient(request.params.id);
      return { ok: true };
    },
  );

  app.get(
    "/office/google-ads/clients/:id/analysis",
    {
      schema: {
        tags: ["google-ads"],
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: analysisSchema,
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        const analysis = await runAnalysis(request.params.id);
        return JSON.parse(JSON.stringify(analysis));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao consultar Google Ads.";
        return reply.status(400).send({ message });
      }
    },
  );

  app.post(
    "/office/google-ads/clients/:id/recommendations/apply",
    {
      schema: {
        tags: ["google-ads"],
        params: z.object({ id: z.string().min(1) }),
        body: applyNegativeKeywordBodySchema,
        response: {
          200: z.object({ ok: z.boolean() }),
          400: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      try {
        await applyNegativeKeyword(request.params.id, request.body.campaignId, request.body.term);
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao aplicar palavra negativa.";
        return reply.status(400).send({ message });
      }
    },
  );
};

/**
 * Callback OAuth — PUBLICO de proposito: e o navegador do usuario sendo
 * redirecionado de volta pelo Google apos o consentimento, sem a sessao
 * autenticada da OperaIA.lab presente do jeito que as outras rotas exigem.
 * A autenticidade vem do "state" assinado pelo proprio fluxo (nao de cookie
 * de sessao) — mesmo padrao do webhook do GitHub (validado por HMAC, nao login).
 */
export const createGoogleAdsCallbackRoute: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/office/google-ads/callback",
    {
      schema: {
        tags: ["google-ads"],
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { code, state, error } = request.query;
      if (error || !code || !state) {
        return reply.redirect(`${FRONTEND_RETURN_URL}?googleAds=erro`);
      }
      try {
        const decoded = decodeState(state);
        const { refreshToken } = await exchangeCodeForRefreshToken(code);
        await saveConnection({
          clientId: decoded.clientId,
          customerId: decoded.customerId,
          loginCustomerId: decoded.loginCustomerId,
          refreshToken,
        });
        return reply.redirect(`${FRONTEND_RETURN_URL}?googleAds=conectado`);
      } catch (err) {
        console.error("[google-ads] falha no callback OAuth", err);
        return reply.redirect(`${FRONTEND_RETURN_URL}?googleAds=erro`);
      }
    },
  );
};
