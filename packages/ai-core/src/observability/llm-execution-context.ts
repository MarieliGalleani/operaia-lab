/**
 * Contexto de execucao LLM — sem acoplar a Prisma/Mission.
 * Preenchido pela camada de orquestracao (API/runtime) via AsyncLocalStorage.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface LLMExecutionContext {
  readonly missionId?: string;
  readonly correlationId?: string;
}

const storage = new AsyncLocalStorage<LLMExecutionContext>();

/** Le o contexto da chamada LLM atual (se houver). */
export function getLLMExecutionContext(): LLMExecutionContext | undefined {
  return storage.getStore();
}

/** Executa `fn` com contexto LLM (propaga para awaits / setImmediate). */
export function runWithLLMExecutionContext<T>(
  context: LLMExecutionContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}
