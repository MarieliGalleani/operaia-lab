import type {
  LLMCompletion,
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
} from "../llm-provider.js";
import type { LLMObserver } from "../observability/llm-observer.js";
import { NoopLLMObserver } from "../observability/llm-observer.js";

/**
 * Tenta providers em ordem ate um completar com sucesso.
 * Estrutura pronta para operacao continua; fallbacks futuros entram na lista.
 */
export class FallbackLLMProvider implements LLMProvider {
  readonly name: string;
  private readonly providers: readonly LLMProvider[];
  private readonly observer: LLMObserver;

  constructor(
    providers: readonly LLMProvider[],
    observer: LLMObserver = new NoopLLMObserver(),
  ) {
    if (providers.length === 0) {
      throw new Error("FallbackLLMProvider exige ao menos um provider.");
    }
    this.providers = providers;
    this.observer = observer;
    this.name = `fallback:${providers.map((provider) => provider.name).join("|")}`;
  }

  async complete(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion> {
    let lastError: unknown;

    for (let index = 0; index < this.providers.length; index += 1) {
      const provider = this.providers[index]!;
      try {
        return await provider.complete(messages, options);
      } catch (error) {
        lastError = error;
        const next = this.providers[index + 1];
        if (!next) {
          break;
        }
        const reason =
          error instanceof Error ? error.message : "erro desconhecido";
        this.observer.onEvent({
          type: "fallback_used",
          fromProvider: provider.name,
          toProvider: next.name,
          reason,
          at: new Date().toISOString(),
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("FallbackLLMProvider: todos os providers falharam.");
  }
}
