import type { UUID } from "@operaia/shared";
import type { ActionOutput, ActionStatus } from "./action.js";
import type { ExecutionLog } from "./execution-log.js";

/** Status agregado de uma execucao. */
export const ExecutionStatus = {
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
} as const;
export type ExecutionStatus =
  (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

/** Resultado da execucao de uma unica acao. */
export interface ActionResult {
  readonly actionId: UUID;
  readonly type: string;
  readonly status: ActionStatus;
  readonly executor: string | null;
  readonly output?: ActionOutput;
  readonly error?: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly durationMs: number;
}

/** Resultado completo de uma execucao de plano. */
export interface ExecutionResult {
  readonly executionId: UUID;
  readonly status: ExecutionStatus;
  /** Acoes executadas com sucesso. */
  readonly executed: readonly ActionResult[];
  /** Acoes que falharam. */
  readonly failed: readonly ActionResult[];
  /** Todas as acoes, na ordem de execucao. */
  readonly results: readonly ActionResult[];
  readonly durationMs: number;
  readonly logs: readonly ExecutionLog[];
}
