import type { LLMProviderConfig, LLMProviderId } from "../llm-config.js";
import type { LLMProvider } from "../llm-provider.js";
import {
  ConsoleLLMObserver,
  NoopLLMObserver,
  type LLMObserver,
} from "../observability/llm-observer.js";
import { ObservableLLMProvider } from "../observability/observable-llm-provider.js";
import {
  composePolicies,
  MaxTokensClampPolicy,
  NonEmptyPromptPolicy,
  PassthroughLLMPolicy,
  type LLMPolicy,
} from "../policy/llm-policy.js";
import { PolicyLLMProvider } from "../policy/policy-llm-provider.js";
import { createLLMProvider } from "./create-llm-provider.js";
import { FallbackLLMProvider } from "./fallback-llm-provider.js";

/** Providers com implementacao concreta disponivel hoje. */
export function isLLMProviderImplemented(id: LLMProviderId): boolean {
  return id === "gemini" || id === "deterministic";
}

/**
 * Cadeia de fallback apos o primario.
 * Deterministic e sempre a rede de seguranca final (se o primario nao for ele).
 */
export function resolveLLMFallbackChain(
  primary: LLMProviderId,
  configured: readonly LLMProviderId[] = [],
): readonly LLMProviderId[] {
  const chain: LLMProviderId[] = [];
  for (const id of configured) {
    if (id === primary) {
      continue;
    }
    if (!chain.includes(id)) {
      chain.push(id);
    }
  }
  if (primary !== "deterministic" && !chain.includes("deterministic")) {
    chain.push("deterministic");
  }
  return chain;
}

export interface LLMStackConfig extends LLMProviderConfig {
  /** Cadeia de fallback (ordem de tentativa apos o primario). */
  readonly fallbackProviders?: readonly LLMProviderId[];
  readonly observer?: LLMObserver;
  readonly policies?: readonly LLMPolicy[];
  /** Clamp tecnico de maxTokens (policy layer). */
  readonly maxTokensClamp?: number;
  /** Quando true e sem observer custom, usa ConsoleLLMObserver. */
  readonly enableConsoleObservability?: boolean;
}

/**
 * Monta o stack operacional:
 *   Policy → Observable (por tentativa) → Fallback
 *
 * Employees / Orchestrator recebem apenas LLMProvider.
 */
export function createLLMStack(config: LLMStackConfig): LLMProvider {
  const observer =
    config.observer ??
    (config.enableConsoleObservability === false
      ? new NoopLLMObserver()
      : new ConsoleLLMObserver());

  const policy = composePolicies([
    new NonEmptyPromptPolicy(),
    new MaxTokensClampPolicy(config.maxTokensClamp ?? 8192),
    new PassthroughLLMPolicy(),
    ...(config.policies ?? []),
  ]);

  const primary = wrapProvider(
    createLLMProvider(config),
    policy,
    observer,
  );

  const fallbackIds = resolveLLMFallbackChain(
    config.provider,
    config.fallbackProviders ?? [],
  );

  const fallbacks: LLMProvider[] = [];
  for (const fallbackId of fallbackIds) {
    if (!isLLMProviderImplemented(fallbackId)) {
      console.warn(
        `[llm] fallback "${fallbackId}" ignorado — provider ainda nao implementado.`,
      );
      continue;
    }
    try {
      const created = createLLMProvider({
        ...config,
        provider: fallbackId,
      });
      fallbacks.push(wrapProvider(created, policy, observer));
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "falha ao criar fallback";
      console.warn(`[llm] fallback "${fallbackId}" indisponivel: ${reason}`);
    }
  }

  if (fallbacks.length === 0) {
    console.info(`[llm] stack primary=${config.provider} (sem fallback)`);
    return primary;
  }

  console.info(
    `[llm] stack primary=${config.provider} fallbacks=${fallbacks
      .map((provider) => provider.name)
      .join(" → ")}`,
  );
  return new FallbackLLMProvider([primary, ...fallbacks], observer);
}

function wrapProvider(
  provider: LLMProvider,
  policy: LLMPolicy,
  observer: LLMObserver,
): LLMProvider {
  return new ObservableLLMProvider(
    new PolicyLLMProvider(provider, policy),
    observer,
  );
}
