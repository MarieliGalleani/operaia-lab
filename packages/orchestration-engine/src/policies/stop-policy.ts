import { OrchestrationStatus } from "../engine/orchestration-state.js";
import type { OrchestrationState } from "../engine/orchestration-state.js";
import type { LoopPolicy } from "./loop-policy.js";

/** Motivo pelo qual o loop deve (ou nao) parar. */
export const StopReason = {
  CONTINUE: "CONTINUE",
  OBJECTIVE_COMPLETED: "OBJECTIVE_COMPLETED",
  MAX_CYCLES: "MAX_CYCLES",
  MAX_FAILURES: "MAX_FAILURES",
  MAX_DURATION: "MAX_DURATION",
  CANCELLED: "CANCELLED",
  FATAL_ERROR: "FATAL_ERROR",
} as const;
export type StopReason = (typeof StopReason)[keyof typeof StopReason];

export interface StopEvaluation {
  readonly state: OrchestrationState;
  readonly policy: LoopPolicy;
  readonly elapsedMs: number;
  readonly cancelled: boolean;
  readonly fatal: boolean;
}

export interface StopDecision {
  readonly stop: boolean;
  readonly reason: StopReason;
}

/** Politica de parada plugavel. */
export interface StopPolicy {
  evaluate(input: StopEvaluation): StopDecision;
}

/** Politica padrao: cancelamento > fatal > objetivo > falhas > tempo > ciclos. */
export class DefaultStopPolicy implements StopPolicy {
  evaluate(input: StopEvaluation): StopDecision {
    const { state, policy, elapsedMs, cancelled, fatal } = input;

    if (cancelled) {
      return { stop: true, reason: StopReason.CANCELLED };
    }
    if (fatal) {
      return { stop: true, reason: StopReason.FATAL_ERROR };
    }
    if (state.history.at(-1)?.objectiveCompleted === true) {
      return { stop: true, reason: StopReason.OBJECTIVE_COMPLETED };
    }
    const failures = state.history.filter((c) => c.error !== null).length;
    if (policy.maxFailures !== null && failures >= policy.maxFailures) {
      return { stop: true, reason: StopReason.MAX_FAILURES };
    }
    if (policy.maxDurationMs !== null && elapsedMs >= policy.maxDurationMs) {
      return { stop: true, reason: StopReason.MAX_DURATION };
    }
    if (state.currentCycle >= policy.maxCycles) {
      return { stop: true, reason: StopReason.MAX_CYCLES };
    }
    return { stop: false, reason: StopReason.CONTINUE };
  }
}

/** Traduz o motivo de parada para o status terminal da orquestracao. */
export function statusFromStopReason(reason: StopReason): OrchestrationStatus {
  switch (reason) {
    case StopReason.OBJECTIVE_COMPLETED:
      return OrchestrationStatus.COMPLETED;
    case StopReason.CANCELLED:
      return OrchestrationStatus.CANCELLED;
    case StopReason.MAX_CYCLES:
    case StopReason.MAX_FAILURES:
    case StopReason.MAX_DURATION:
    case StopReason.FATAL_ERROR:
      return OrchestrationStatus.FAILED;
    case StopReason.CONTINUE:
      return OrchestrationStatus.RUNNING;
    default:
      return OrchestrationStatus.FAILED;
  }
}
