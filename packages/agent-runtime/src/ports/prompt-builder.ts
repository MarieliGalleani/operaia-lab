import type { LLMMessage } from "@operaia/ai-core";
import type { ExecutionContext } from "../types/execution-context.js";

/**
 * Monta as mensagens enviadas ao modelo a partir do contexto de execucao
 * (instrucoes do agente, memoria recuperada, ferramentas e mensagem do usuario).
 */
export interface PromptBuilder {
  build(
    context: ExecutionContext,
  ): Promise<readonly LLMMessage[]> | readonly LLMMessage[];
}
