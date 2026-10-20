import { createLLMStack, parseLLMProviderList, type LLMProvider } from "@operaia/ai-core";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import { buildOfficeStatus } from "../office/build-office-status.js";
import { buildCeoBriefing, type BriefingHealth } from "./ceo-briefing.js";
import { chatWithOpera } from "./ceo-chat.js";

let cachedLlm: LLMProvider | null = null;

/** Mesma cadeia do escritorio: Claude → Gemini → deterministico. */
function getLlm(): LLMProvider {
  if (cachedLlm) return cachedLlm;
  cachedLlm = createLLMStack({
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL,
    geminiApiKey: env.GEMINI_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openRouterApiKey: env.OPENROUTER_API_KEY,
    fallbackProviders: parseLLMProviderList(env.LLM_FALLBACK_PROVIDERS),
    maxTokensClamp: env.LLM_MAX_TOKENS_CLAMP,
    enableConsoleObservability: env.LLM_OBSERVABILITY,
  });
  return cachedLlm;
}

const chatBodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "opera"]), text: z.string().max(4000) }))
    .max(20)
    .default([]),
});

export function createCeoRoomRoutes(runtime: ContinuousRuntime): FastifyPluginAsyncZod {
  const loadHealth = async (): Promise<BriefingHealth | null> => {
    const s = await buildOfficeStatus(runtime);
    return {
      level: s.status.level,
      label: s.status.label,
      summary: s.status.summary,
      workersAlive: s.status.workers.alive,
      workersExpected: s.status.workers.expected,
      queued: s.status.queue.queued,
      running: s.status.queue.running,
      waiting: s.status.queue.waiting,
    };
  };

  return async (app) => {
    // Somente leitura: o que a Opera esta vendo agora.
    app.get("/office/ceo/briefing", {}, async () =>
      buildCeoBriefing({ loadHealth }),
    );

    // Conversa: nao cria missao; propoe demanda quando o pedido e trabalho.
    app.post(
      "/office/ceo/chat",
      { schema: { body: chatBodySchema } },
      async (request) => {
        const briefing = await buildCeoBriefing({ loadHealth });
        return chatWithOpera({
          llm: getLlm(),
          message: request.body.message,
          history: request.body.history,
          briefing,
        });
      },
    );
  };
}
