/**
 * Configuracao tipada para criacao de LLMProvider.
 * Provedores futuros entram aqui sem mudar Employees / Orchestrator.
 */
export const LLM_PROVIDER_IDS = [
  "gemini",
  "openai",
  "anthropic",
  "openrouter",
  "deterministic",
] as const;

export type LLMProviderId = (typeof LLM_PROVIDER_IDS)[number];

export interface LLMProviderConfig {
  readonly provider: LLMProviderId;
  /** Modelo padrao (ex.: gemini-3.6-flash). */
  readonly model?: string;
  readonly geminiApiKey?: string;
  readonly openaiApiKey?: string;
  readonly anthropicApiKey?: string;
  readonly openRouterApiKey?: string;
}

/** Parseia lista CSV de providers (ex.: "openai,anthropic"). */
export function parseLLMProviderList(
  value: string | undefined,
): readonly LLMProviderId[] {
  if (!value?.trim()) {
    return [];
  }
  const allowed = new Set<string>(LLM_PROVIDER_IDS);
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is LLMProviderId => allowed.has(item));
}
