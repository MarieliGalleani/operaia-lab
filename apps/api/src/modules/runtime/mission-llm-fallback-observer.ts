/**
 * Adapter produto: LLMObserver → MissionEvent (sem acoplar ai-core ao Prisma).
 * Persiste apenas fallback_used quando missionId esta presente.
 */
import type { LLMExecutionEvent, LLMObserver } from "@operaia/ai-core";
import type { Prisma } from "@operaia/database";

export const LLM_FALLBACK_MISSION_EVENT_TYPE = "llm_fallback_used";

export interface MissionFallbackEventSink {
  appendEvent(
    missionId: string,
    type: string,
    message: string,
    payload?: Prisma.InputJsonValue,
  ): Promise<void>;
}

export interface MissionFallbackLLMObserverOptions {
  readonly sink?: MissionFallbackEventSink | null;
  readonly logger?: {
    error(obj: Record<string, unknown>, msg?: string): void;
  };
}

/**
 * Observa fallback_used e grava MissionEvent quando ha missionId.
 * Sink pode ser ligado depois do bootstrap (fila ContinuousRuntime).
 */
export class MissionFallbackLLMObserver implements LLMObserver {
  private sink: MissionFallbackEventSink | null;
  private readonly logger: MissionFallbackLLMObserverOptions["logger"];
  private readonly pending: Promise<void>[] = [];

  constructor(options: MissionFallbackLLMObserverOptions = {}) {
    this.sink = options.sink ?? null;
    this.logger = options.logger;
  }

  bindSink(sink: MissionFallbackEventSink | null): void {
    this.sink = sink;
  }

  /** Aguarda persistencias em voo (testes / validacao). */
  async flush(): Promise<void> {
    await Promise.allSettled(this.pending.splice(0, this.pending.length));
  }

  onEvent(event: LLMExecutionEvent): void {
    if (event.type !== "fallback_used") {
      return;
    }
    if (!event.missionId || !this.sink) {
      return;
    }

    const payload = {
      type: event.type,
      fromProvider: event.fromProvider,
      toProvider: event.toProvider,
      reason: event.reason,
      at: event.at,
      ...(event.correlationId ? { correlationId: event.correlationId } : {}),
    } satisfies Record<string, string>;

    const task = this.sink
      .appendEvent(
        event.missionId,
        LLM_FALLBACK_MISSION_EVENT_TYPE,
        `LLM fallback ${event.fromProvider} -> ${event.toProvider}`,
        payload as Prisma.InputJsonValue,
      )
      .catch((error: unknown) => {
        this.logger?.error(
          {
            component: "mission-fallback-llm-observer",
            event: "persist_failed",
            missionId: event.missionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Falha ao persistir MissionEvent de fallback LLM",
        );
      });
    this.pending.push(task);
  }
}
