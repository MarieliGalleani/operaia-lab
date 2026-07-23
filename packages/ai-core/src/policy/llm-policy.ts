import type {
  LLMCompletionOptions,
  LLMMessage,
} from "../llm-provider.js";

/**
 * Camada de politica LLM (base).
 * Nao conhece Employees nem regras de negocio do escritorio —
 * apenas ajusta contrato tecnico da chamada (options / mensagens).
 */
export interface LLMPolicy {
  readonly name: string;
  applyMessages?(
    messages: readonly LLMMessage[],
  ): readonly LLMMessage[];
  applyOptions?(
    options?: LLMCompletionOptions,
  ): LLMCompletionOptions | undefined;
}

/** Politica vazia — ponto de extensao padrao. */
export class PassthroughLLMPolicy implements LLMPolicy {
  readonly name = "passthrough";
}

/**
 * Garante um teto de maxTokens quando informado na chamada.
 * Nao inventa tokens default — so clamp se o caller pediu maxTokens.
 */
export class MaxTokensClampPolicy implements LLMPolicy {
  readonly name = "max-tokens-clamp";

  constructor(private readonly maxAllowed: number) {}

  applyOptions(
    options?: LLMCompletionOptions,
  ): LLMCompletionOptions | undefined {
    if (!options?.maxTokens) {
      return options;
    }
    return {
      ...options,
      maxTokens: Math.min(options.maxTokens, this.maxAllowed),
    };
  }
}

/** Rejeita prompts vazios (defesa tecnica, nao regra de negocio). */
export class NonEmptyPromptPolicy implements LLMPolicy {
  readonly name = "non-empty-prompt";

  applyMessages(messages: readonly LLMMessage[]): readonly LLMMessage[] {
    const hasContent = messages.some((message) => message.content.trim());
    if (!hasContent) {
      throw new Error("LLMPolicy: prompt vazio rejeitado.");
    }
    return messages;
  }
}

export function composePolicies(
  policies: readonly LLMPolicy[],
): LLMPolicy {
  return {
    name: policies.map((policy) => policy.name).join("+") || "empty",
    applyMessages(messages) {
      return policies.reduce(
        (current, policy) =>
          policy.applyMessages ? policy.applyMessages(current) : current,
        messages,
      );
    },
    applyOptions(options) {
      return policies.reduce(
        (current, policy) =>
          policy.applyOptions ? policy.applyOptions(current) : current,
        options,
      );
    },
  };
}
