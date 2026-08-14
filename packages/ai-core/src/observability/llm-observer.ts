import type { LLMCompletion } from "../llm-provider.js";

/** Eventos de execucao LLM — observabilidade sem acoplar ao SDK. */
export type LLMExecutionEvent =
  | {
      readonly type: "call_started";
      readonly provider: string;
      readonly model?: string;
      readonly messageCount: number;
      readonly at: string;
    }
  | {
      readonly type: "call_succeeded";
      readonly provider: string;
      readonly model: string;
      readonly durationMs: number;
      readonly usage?: LLMCompletion["usage"];
      readonly at: string;
    }
  | {
      readonly type: "call_failed";
      readonly provider: string;
      readonly model?: string;
      readonly durationMs: number;
      readonly error: string;
      readonly at: string;
    }
  | {
      readonly type: "fallback_used";
      readonly fromProvider: string;
      readonly toProvider: string;
      readonly reason: string;
      readonly at: string;
      /** Preenchido quando a chamada ocorre dentro de uma Mission. */
      readonly missionId?: string;
      /** Trace opcional (ex.: DomainSignal.correlationId ou missionId). */
      readonly correlationId?: string;
    };

export interface LLMObserver {
  onEvent(event: LLMExecutionEvent): void;
}

/** Fan-out para varios observers (console + recording + persistencia). */
export function composeLLMObservers(
  ...observers: readonly LLMObserver[]
): LLMObserver {
  return {
    onEvent(event: LLMExecutionEvent): void {
      for (const observer of observers) {
        observer.onEvent(event);
      }
    },
  };
}

/** Observer no-op — util em testes quando a observabilidade nao importa. */
export class NoopLLMObserver implements LLMObserver {
  onEvent(): void {
    // intencionalmente vazio
  }
}

/**
 * Observer em memoria para testes e diagnostico local.
 * Nao e persistencia de longo prazo — so captura o ciclo atual.
 */
export class RecordingLLMObserver implements LLMObserver {
  private readonly events: LLMExecutionEvent[] = [];

  onEvent(event: LLMExecutionEvent): void {
    this.events.push(event);
  }

  snapshot(): readonly LLMExecutionEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}

/** Observer que escreve no console (API / operacao). */
export class ConsoleLLMObserver implements LLMObserver {
  onEvent(event: LLMExecutionEvent): void {
    switch (event.type) {
      case "call_started":
        console.log(
          `[llm] start provider=${event.provider} messages=${event.messageCount}`,
        );
        break;
      case "call_succeeded":
        console.log(
          `[llm] ok provider=${event.provider} model=${event.model} ` +
            `ms=${event.durationMs} tokens=${event.usage?.completionTokens ?? "?"}`,
        );
        break;
      case "call_failed":
        console.error(
          `[llm] fail provider=${event.provider} ms=${event.durationMs} error=${event.error}`,
        );
        break;
      case "fallback_used": {
        const missionPart = event.missionId
          ? ` missionId=${event.missionId}`
          : "";
        const corrPart = event.correlationId
          ? ` correlationId=${event.correlationId}`
          : "";
        console.warn(
          `[llm] fallback ${event.fromProvider} -> ${event.toProvider}: ${event.reason}${missionPart}${corrPart}`,
        );
        break;
      }
    }
  }
}
