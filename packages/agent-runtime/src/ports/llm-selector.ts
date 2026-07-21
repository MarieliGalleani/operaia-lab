import type { LLMProvider } from "@operaia/ai-core";
import type { ExecutionContext } from "../types/execution-context.js";

/**
 * Estrategia de selecao do provedor de LLM para uma execucao.
 * Permite roteamento futuro por agente, custo ou capacidade sem tocar no kernel.
 */
export interface LLMSelector {
  select(context: ExecutionContext): Promise<LLMProvider> | LLMProvider;
}
