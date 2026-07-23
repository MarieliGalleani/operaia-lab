import type {
  LLMCompletion,
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
} from "../llm-provider.js";
import type { LLMObserver } from "./llm-observer.js";

/**
 * Decorator: envolve qualquer LLMProvider e emite eventos de execucao.
 * Employees continuam vendo apenas LLMProvider.
 */
export class ObservableLLMProvider implements LLMProvider {
  readonly name: string;

  constructor(
    private readonly inner: LLMProvider,
    private readonly observer: LLMObserver,
  ) {
    this.name = `observable:${inner.name}`;
  }

  async complete(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion> {
    const started = Date.now();
    const at = new Date().toISOString();
    this.observer.onEvent({
      type: "call_started",
      provider: this.inner.name,
      model: options?.model,
      messageCount: messages.length,
      at,
    });

    try {
      const completion = await this.inner.complete(messages, options);
      this.observer.onEvent({
        type: "call_succeeded",
        provider: this.inner.name,
        model: completion.model,
        durationMs: Date.now() - started,
        usage: completion.usage,
        at: new Date().toISOString(),
      });
      return completion;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "erro desconhecido";
      this.observer.onEvent({
        type: "call_failed",
        provider: this.inner.name,
        model: options?.model,
        durationMs: Date.now() - started,
        error: message,
        at: new Date().toISOString(),
      });
      throw error;
    }
  }
}
