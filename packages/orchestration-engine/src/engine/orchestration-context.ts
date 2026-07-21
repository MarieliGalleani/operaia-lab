/** Contexto de uma orquestracao, incluindo sinal de cancelamento. */
export interface OrchestrationContext {
  readonly id: string;
  readonly objective: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly signal: AbortSignal | undefined;
}
