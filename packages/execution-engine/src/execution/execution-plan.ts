import type { UUID } from "@operaia/shared";
import type { Action } from "./action.js";

/**
 * Plano executavel consumido pelo Engine: uma lista ordenada de acoes.
 *
 * NOTA: este `ExecutionPlan` e do Engine e representa TRABALHO executavel.
 * Nao confundir com o `ExecutionPlan` do @operaia/agent-runtime, que descreve
 * os passos do pipeline de raciocinio. O Engine nao conhece o Runtime; a
 * conversao entre os dois e responsabilidade de uma camada de orquestracao.
 */
export interface ExecutionPlan {
  readonly id: UUID;
  readonly actions: readonly Action[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
