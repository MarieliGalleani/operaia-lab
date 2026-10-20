import { createLLMStack, parseLLMProviderList, type LLMProvider } from "@operaia/ai-core";
import {
  STORE_FLOW_CHANNELS,
  parseProductsCsv,
  runStoreFlow,
  type StoreFlowChannel,
} from "@operaia/store-flow";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../../config/env.js";

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
      return { run, productCount: products.length };
    },
  );
};
