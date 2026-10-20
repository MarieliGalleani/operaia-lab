import { createLLMStack, parseLLMProviderList, type LLMProvider } from "@operaia/ai-core";
import {
  STORE_FLOW_CHANNELS,
  parseProductsCsv,
  runStoreFlow,
  type StoreFlowChannel,
} from "@operaia/store-flow";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@operaia/database";
import { env } from "../../config/env.js";

/** Rodada salva cabe folgada em 2 MB (20 produtos x 4 canais x 2 variantes). */
const MAX_RUN_JSON_BYTES = 2_000_000;

/**
 * Tabela ainda nao criada (migracao pendente): a rodada continua
 * funcionando como antes, so sem salvar no servidor.
 */
function isMissingTable(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return e?.code === "P2021" || /store_flow_runs.*does not exist|relation .*store_flow_runs/i.test(String(e?.message ?? ""));
}

export const storeFlowSavedRunSchema = z
  .object({
    curated: z.array(z.unknown()).max(100),
    rejected: z.array(z.unknown()).max(500),
    drafts: z.array(z.object({ id: z.string(), status: z.enum(["PENDING_APPROVAL", "APPROVED", "REJECTED"]) }).passthrough()).max(400),
  })
  .passthrough();

/**
 * Store Flow (4º andar) — rodada pelo app (Interface 3.0).
 *
 * Antes a rodada so saia rodando o CLI na VM e subindo o .json na tela.
 * Agora a tela manda o CSV do portal de afiliados e recebe a rodada
 * pronta: Flow escolhe os produtos, Driele escreve os rascunhos. Nada e
 * publicado — todo rascunho volta como PENDING_APPROVAL para a Sala de
 * Aprovacao.
 */

const MAX_CSV_BYTES = 1_000_000;

let cachedLlm: LLMProvider | null = null;

function getLlm(): LLMProvider {
  if (cachedLlm) return cachedLlm;
  cachedLlm = createLLMStack({
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL,
    geminiApiKey: env.GEMINI_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openRouterApiKey: env.OPENROUTER_API_KEY,
    // Sem isso, Anthropic sem credito = todas as etapas em texto pronto.
    fallbackProviders: parseLLMProviderList(env.LLM_FALLBACK_PROVIDERS),
    maxTokensClamp: env.LLM_MAX_TOKENS_CLAMP,
    enableConsoleObservability: env.LLM_OBSERVABILITY,
  });
  return cachedLlm;
}

export const storeFlowRunBodySchema = z.object({
  csv: z.string().min(1).max(MAX_CSV_BYTES),
  niche: z.string().trim().min(2).max(120),
  channels: z
    .array(z.enum(STORE_FLOW_CHANNELS as unknown as [StoreFlowChannel, ...StoreFlowChannel[]]))
    .min(1)
    .max(STORE_FLOW_CHANNELS.length),
  categories: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  maxProducts: z.number().int().min(1).max(20).optional(),
  tone: z.string().trim().max(120).optional(),
  abTest: z.boolean().optional(),
});

export const storeFlowRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/store-flow/runs",
    {
      bodyLimit: MAX_CSV_BYTES + 64_000,
      schema: {
        tags: ["store-flow"],
        body: storeFlowRunBodySchema,
      },
    },
    async (request, reply) => {
      const body = request.body;
      let products;
      try {
        products = parseProductsCsv(body.csv);
      } catch (error) {
        return reply.status(400).send({
          code: "CSV_INVALIDO",
          message: error instanceof Error ? error.message : "Não consegui ler o CSV.",
        });
      }
      if (products.length === 0) {
        return reply.status(400).send({
          code: "CSV_VAZIO",
          message: "O CSV não tem nenhum produto. Confira o cabeçalho e as linhas.",
        });
      }
      const run = await runStoreFlow({
        products,
        llm: getLlm(),
        abTest: body.abTest ?? true,
        campaignId: `sf-${Date.now().toString(36)}`,
        config: {
          niche: body.niche,
          channels: body.channels,
          categories: body.categories ?? [],
          ...(body.maxProducts ? { maxProducts: body.maxProducts } : {}),
          ...(body.tone ? { tone: body.tone } : {}),
        },
      });
      let runId: string | null = null;
      try {
        const saved = await prisma.storeFlowRun.create({
          data: {
            niche: body.niche,
            channelsJson: body.channels,
            productCount: products.length,
            runJson: run as object,
            createdBy: request.authenticatedAdmin?.login ?? null,
          },
          select: { id: true },
        });
        runId = saved.id;
      } catch (error) {
        if (!isMissingTable(error)) request.log.error({ err: error }, "store-flow: falha ao salvar rodada");
      }
      return { run, productCount: products.length, runId };
    },
  );

  // Ultima rodada salva: qualquer aparelho abre a mesma fila.
  app.get("/store-flow/runs/latest", {}, async () => {
    try {
      const row = await prisma.storeFlowRun.findFirst({ orderBy: { createdAt: "desc" } });
      if (!row) return { runId: null, run: null, saved: true };
      return { runId: row.id, run: row.runJson, niche: row.niche, updatedAt: row.updatedAt.toISOString(), saved: true };
    } catch (error) {
      if (isMissingTable(error)) return { runId: null, run: null, saved: false };
      throw error;
    }
  });

  // Rodada aberta de um .json (CLI): passa a valer para todos os aparelhos.
  app.post(
    "/store-flow/runs/import",
    { bodyLimit: MAX_RUN_JSON_BYTES, schema: { body: z.object({ run: storeFlowSavedRunSchema, niche: z.string().trim().max(120).optional() }) } },
    async (request, reply) => {
      try {
        const saved = await prisma.storeFlowRun.create({
          data: {
            niche: request.body.niche || "importada",
            channelsJson: [],
            productCount: request.body.run.curated.length,
            runJson: request.body.run as object,
            createdBy: request.authenticatedAdmin?.login ?? null,
          },
          select: { id: true },
        });
        return { runId: saved.id };
      } catch (error) {
        if (isMissingTable(error)) return reply.status(503).send({ code: "STORE_FLOW_SEM_TABELA", message: "Salvar no servidor ainda não está ativo." });
        throw error;
      }
    },
  );

  // Aprovar/recusar/editar na Sala de Aprovacao grava aqui.
  app.put(
    "/store-flow/runs/:id",
    {
      bodyLimit: MAX_RUN_JSON_BYTES,
      schema: { params: z.object({ id: z.string().uuid() }), body: z.object({ run: storeFlowSavedRunSchema }) },
    },
    async (request, reply) => {
      try {
        const updated = await prisma.storeFlowRun.update({
          where: { id: request.params.id },
          data: { runJson: request.body.run as object },
          select: { id: true, updatedAt: true },
        });
        return { runId: updated.id, updatedAt: updated.updatedAt.toISOString() };
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        if (code === "P2025") return reply.status(404).send({ code: "NOT_FOUND", message: "Rodada não encontrada." });
        if (isMissingTable(error)) return reply.status(503).send({ code: "STORE_FLOW_SEM_TABELA", message: "Salvar no servidor ainda não está ativo." });
        throw error;
      }
    },
  );
};
