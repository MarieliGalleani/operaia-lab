import type { LLMCompletion } from "@operaia/ai-core";
import type { AgentAction } from "./action.js";
import type { ExecutionPlan, ExecutionStep } from "./execution-plan.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Registro de um estagio do pipeline, com duracao para observabilidade. */
export interface RuntimeLog {
  readonly step: ExecutionStep;
  readonly level: LogLevel;
  readonly message: string;
  readonly at: Date;
  readonly durationMs?: number;
}

/** Uso do modelo, reaproveitando o formato exposto por @operaia/ai-core. */
export type RuntimeUsage = NonNullable<LLMCompletion["usage"]>;

/** Resultado completo de uma execucao do runtime. */
export interface RuntimeResponse {
  readonly output: string;
  readonly plan: ExecutionPlan;
  readonly actions: readonly AgentAction[];
  readonly usage: RuntimeUsage | null;
  readonly logs: readonly RuntimeLog[];
}
