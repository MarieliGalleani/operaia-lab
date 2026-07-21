import type { OrchestrationResult } from "@operaia/orchestration-engine";

export interface SessionRunInput {
  readonly objective: string;
  readonly sessionId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly signal?: AbortSignal;
}

/**
 * Porta que o WorkspaceManager usa para executar um ciclo de orquestracao.
 * Desacopla o manager do OrchestrationEngine concreto (implementado pelo
 * OrchestrationAdapter).
 */
export interface SessionRunner {
  run(input: SessionRunInput): Promise<OrchestrationResult>;
}
