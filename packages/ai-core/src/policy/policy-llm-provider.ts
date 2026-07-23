import type {
  LLMCompletion,
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
} from "../llm-provider.js";
import type { LLMPolicy } from "./llm-policy.js";

/**
 * Aplica LLMPolicy ao redor de um provider concreto.
 * Mantem o contrato LLMProvider para o restante do sistema.
 */
export class PolicyLLMProvider implements LLMProvider {
  readonly name: string;

  constructor(
    private readonly inner: LLMProvider,
    private readonly policy: LLMPolicy,
  ) {
    this.name = `policy(${policy.name}):${inner.name}`;
  }

  async complete(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion> {
    const nextMessages = this.policy.applyMessages
      ? this.policy.applyMessages(messages)
      : messages;
    const nextOptions = this.policy.applyOptions
      ? this.policy.applyOptions(options)
      : options;
    return this.inner.complete(nextMessages, nextOptions);
  }
}
