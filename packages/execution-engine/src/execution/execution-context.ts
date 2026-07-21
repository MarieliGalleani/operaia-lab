import type { UUID } from "@operaia/shared";

/**
 * Contexto de uma execucao, repassado a cada executor.
 * Carrega identificacao e metadados, sem expor detalhes do Engine.
 */
export interface ExecutionContext {
  readonly executionId: UUID;
  readonly startedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}
