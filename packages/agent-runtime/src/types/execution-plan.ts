/** Estagios do pipeline de execucao do runtime, na ordem obrigatoria. */
export const ExecutionStep = {
  LOAD_AGENT: "LOAD_AGENT",
  BUILD_CONTEXT: "BUILD_CONTEXT",
  LOAD_MEMORY: "LOAD_MEMORY",
  DISCOVER_TOOLS: "DISCOVER_TOOLS",
  BUILD_PROMPT: "BUILD_PROMPT",
  GENERATE_EXECUTION_PLAN: "GENERATE_EXECUTION_PLAN",
  EXECUTE_LLM: "EXECUTE_LLM",
} as const;
export type ExecutionStep = (typeof ExecutionStep)[keyof typeof ExecutionStep];

export interface ExecutionPlanStep {
  readonly step: ExecutionStep;
  readonly description: string;
}

/**
 * Plano de execucao deterministico, gerado ANTES da chamada ao modelo.
 * Descreve o que o runtime executou/executara, servindo de trilha de auditoria.
 */
export interface ExecutionPlan {
  readonly steps: readonly ExecutionPlanStep[];
  /** Modelo/alvo selecionado para a execucao. */
  readonly model: string;
  readonly toolNames: readonly string[];
  readonly memoryHits: number;
}
