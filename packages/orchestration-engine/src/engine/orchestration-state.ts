import type { ExecutionSummary } from "../ports/execution-engine.js";

/** Estados do ciclo de vida de uma orquestracao. */
export const OrchestrationStatus = {
  CREATED: "CREATED",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  REPLANNING: "REPLANNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type OrchestrationStatus =
  (typeof OrchestrationStatus)[keyof typeof OrchestrationStatus];

/** Registro imutavel de um ciclo executado. */
export interface CycleRecord {
  readonly cycle: number;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly durationMs: number;
  readonly objectiveCompleted: boolean;
  readonly execution: ExecutionSummary | null;
  readonly error: string | null;
}

/** Estado vivo de uma orquestracao. Evolui a cada ciclo do loop. */
export interface OrchestrationState {
  readonly id: string;
  readonly objective: string;
  currentCycle: number;
  status: OrchestrationStatus;
  readonly startedAt: Date;
  finishedAt: Date | null;
  lastExecution: ExecutionSummary | null;
  readonly history: CycleRecord[];
}
