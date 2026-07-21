import type { OrchestrationState } from "../engine/orchestration-state.js";

/** Tipos de evento emitidos ao longo da orquestracao. */
export const OrchestrationEventType = {
  LOOP_STARTED: "LOOP_STARTED",
  LOOP_FINISHED: "LOOP_FINISHED",
  CYCLE_STARTED: "CYCLE_STARTED",
  REPLANNING: "REPLANNING",
  EXECUTION_COMPLETED: "EXECUTION_COMPLETED",
  CYCLE_FAILED: "CYCLE_FAILED",
  OBJECTIVE_COMPLETED: "OBJECTIVE_COMPLETED",
} as const;
export type OrchestrationEventType =
  (typeof OrchestrationEventType)[keyof typeof OrchestrationEventType];

export interface OrchestrationEvent {
  readonly type: OrchestrationEventType;
  readonly orchestrationId: string;
  readonly cycle: number;
  readonly at: Date;
  readonly data?: Readonly<Record<string, unknown>>;
}

/** Cria um evento a partir do estado atual (fonte unica de construcao). */
export function createEvent(
  type: OrchestrationEventType,
  state: OrchestrationState,
  at: Date,
  data?: Readonly<Record<string, unknown>>,
): OrchestrationEvent {
  return {
    type,
    orchestrationId: state.id,
    cycle: state.currentCycle,
    at,
    ...(data ? { data } : {}),
  };
}
