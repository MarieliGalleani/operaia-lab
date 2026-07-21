import type { UUID } from "@operaia/shared";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Fases observaveis do pipeline de execucao. */
export const ExecutionPhase = {
  PLAN_VALIDATED: "PLAN_VALIDATED",
  ACTION_START: "ACTION_START",
  ACTION_FINISH: "ACTION_FINISH",
  ACTION_ERROR: "ACTION_ERROR",
  EXECUTION_FINISH: "EXECUTION_FINISH",
} as const;
export type ExecutionPhase =
  (typeof ExecutionPhase)[keyof typeof ExecutionPhase];

/** Registro de log de um estagio da execucao (inicio, fim, erro, tempo). */
export interface ExecutionLog {
  readonly level: LogLevel;
  readonly phase: ExecutionPhase;
  readonly message: string;
  readonly at: Date;
  readonly actionId?: UUID;
  readonly executor?: string;
  readonly durationMs?: number;
}
