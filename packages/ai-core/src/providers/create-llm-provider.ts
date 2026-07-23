import type { LLMProviderConfig } from "../llm-config.js";
import type { LLMProvider } from "../llm-provider.js";
import { DeterministicLLMProvider } from "./deterministic-llm-provider.js";
import { GeminiProvider } from "./gemini-provider.js";

/**
 * Composition factory: escolhe a implementacao concreta por configuracao.
 * Trocar provedor = mudar env / config — sem tocar em Employees ou Orchestrator.
 *
 * OpenAI / Anthropic / OpenRouter: slots reservados (ainda nao implementados).
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider) {
    case "deterministic":
      return new DeterministicLLMProvider();

    case "gemini": {
      const apiKey = config.geminiApiKey?.trim();
      if (!apiKey) {
        throw new Error(
          "LLM_PROVIDER=gemini exige GEMINI_API_KEY nas variaveis de ambiente.",
        );
      }
      return new GeminiProvider({
        apiKey,
        model: config.model,
      });
    }

    case "openai":
      throw new Error(
        "OpenAIProvider ainda nao implementado. Use LLM_PROVIDER=gemini ou implemente providers/openai-provider.",
      );

    case "anthropic":
      throw new Error(
        "AnthropicProvider ainda nao implementado. Use LLM_PROVIDER=gemini ou implemente providers/anthropic-provider.",
      );

    case "openrouter":
      throw new Error(
        "OpenRouterProvider ainda nao implementado. Use LLM_PROVIDER=gemini ou implemente providers/openrouter-provider.",
      );

    default: {
      const exhaustive: never = config.provider;
      throw new Error(`LLM provider desconhecido: ${String(exhaustive)}`);
    }
  }
}
