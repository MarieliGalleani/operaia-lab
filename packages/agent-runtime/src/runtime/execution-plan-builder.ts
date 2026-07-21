import {
  ExecutionStep,
  type ExecutionPlan,
} from "../types/execution-plan.js";

export interface ExecutionPlanParams {
  readonly model: string;
  readonly memoryTopK: number;
  readonly memoryHits: number;
  readonly toolNames: readonly string[];
  readonly promptSize: number;
}

/** Monta o plano deterministico que descreve a execucao do pipeline. */
export function buildExecutionPlan(params: ExecutionPlanParams): ExecutionPlan {
  return {
    model: params.model,
    memoryHits: params.memoryHits,
    toolNames: params.toolNames,
    steps: [
      {
        step: ExecutionStep.LOAD_AGENT,
        description: "Carrega a definicao do agente pela chave.",
      },
      {
        step: ExecutionStep.BUILD_CONTEXT,
        description: "Monta o contexto base de execucao.",
      },
      {
        step: ExecutionStep.LOAD_MEMORY,
        description: `Consulta a memoria (topK=${params.memoryTopK}).`,
      },
      {
        step: ExecutionStep.DISCOVER_TOOLS,
        description: `Descobre ferramentas disponiveis (${params.toolNames.length}).`,
      },
      {
        step: ExecutionStep.BUILD_PROMPT,
        description: `Monta o prompt (${params.promptSize} mensagens).`,
      },
      {
        step: ExecutionStep.GENERATE_EXECUTION_PLAN,
        description: "Gera o plano e seleciona o provedor de LLM.",
      },
      {
        step: ExecutionStep.EXECUTE_LLM,
        description: `Executa o modelo alvo (${params.model}).`,
      },
    ],
  };
}
