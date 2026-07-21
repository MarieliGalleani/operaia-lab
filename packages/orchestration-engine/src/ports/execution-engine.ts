import type { ProposedPlan } from "./runtime.js";

/** Status agregado de uma execucao, na visao neutra do orquestrador. */
export const ExecutionOutcomeStatus = {
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
} as const;
export type ExecutionOutcomeStatus =
  (typeof ExecutionOutcomeStatus)[keyof typeof ExecutionOutcomeStatus];

/**
 * Resumo neutro do resultado de uma execucao. O orquestrador NAO importa o
 * ExecutionResult concreto do @operaia/execution-engine; um adapter externo
 * converte para este resumo.
 */
export interface ExecutionSummary {
  readonly status: ExecutionOutcomeStatus;
  readonly executed: number;
  readonly failed: number;
  readonly durationMs: number;
}

/** Porta para o Execution Engine. Recebe um plano opaco e devolve um resumo. */
export interface ExecutionEnginePort {
  execute(plan: ProposedPlan): Promise<ExecutionSummary>;
}
