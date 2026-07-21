import type { ExecutionResult } from "../execution/execution-result.js";

/**
 * Contrato opcional de persistencia do resultado de uma execucao.
 * A implementacao concreta (banco, fila, etc.) vive fora do Engine.
 */
export interface ExecutionStore {
  save(result: ExecutionResult): Promise<void>;
}
