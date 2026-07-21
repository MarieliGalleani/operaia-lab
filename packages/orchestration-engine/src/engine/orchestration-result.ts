import type { ExecutionSummary } from "../ports/execution-engine.js";
import type { CycleRecord, OrchestrationStatus } from "./orchestration-state.js";

/** Resultado final e imutavel de uma orquestracao. */
export interface OrchestrationResult {
  readonly id: string;
  readonly status: OrchestrationStatus;
  readonly cycles: number;
  readonly history: readonly CycleRecord[];
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly duration: number;
  readonly objectiveCompleted: boolean;
  readonly executionSummary: ExecutionSummary | null;
}
