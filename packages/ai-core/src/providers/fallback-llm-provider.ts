import type {
  LLMCompletion,
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
} from "../llm-provider.js";
import { getLLMExecutionContext } from "../observability/llm-execution-context.js";
import type { LLMObserver } from "../observability/llm-observer.js";
import { NoopLLMObserver } from "../observability/llm-observer.js";

/** Provedor fora por credito/chave: pula por 10 min em vez de tentar a cada chamada. */
const PERMANENT_COOLDOWN_MS = 10 * 60 * 1000;
const downUntil = new Map<string, number>();

export function isPermanentProviderError(error: unknown): boolean {
  const e = error as { status?: unknown; message?: unknown } | null;
  const status = Number(e?.status);
  const message = String(e?.message ?? "");
  if (status === 401 || status === 403) return true;
  // 429 (cota/limite por minuto) e passageiro, mesmo quando o texto fala em
  // "billing" (Gemini gratuito): nao tirar o provedor da fila por isso.
  if (status === 429 || /\b429\b|RESOURCE_EXHAUSTED/.test(message)) return false;
  return /credit balance|invalid[_ ]api[_ ]key|api key not valid|permission[_ ]denied/i.test(message);
}

/** So para testes. */
export function resetProviderCooldowns(): void {
  downUntil.clear();
}

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
      const isLast = index === this.providers.length - 1;
      if (!isLast && (downUntil.get(provider.name) ?? 0) > Date.now()) {
        continue;
      }
      try {
        return await provider.complete(messages, options);
      } catch (error) {
        lastError = error;
        if (isPermanentProviderError(error)) {
          downUntil.set(provider.name, Date.now() + PERMANENT_COOLDOWN_MS);
        }
        const next = this.providers[index + 1];
        if (!next) {
          break;
        }
        const reason =
          error instanceof Error ? error.message : "erro desconhecido";
        const executionContext = getLLMExecutionContext();
        this.observer.onEvent({
          type: "fallback_used",
          fromProvider: provider.name,
          toProvider: next.name,
          reason,
          at: new Date().toISOString(),
          ...(executionContext?.missionId
            ? { missionId: executionContext.missionId }
            : {}),
          ...(executionContext?.correlationId
            ? { correlationId: executionContext.correlationId }
            : {}),
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("FallbackLLMProvider: todos os providers falharam.");
  }
}
