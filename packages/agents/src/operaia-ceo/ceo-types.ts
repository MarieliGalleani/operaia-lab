import type { Priority } from "@operaia/shared";

/**
 * Tipos INTERNOS do cerebro do CEO (implementacao do EmployeeBrain).
 * Os contratos publicos (Briefing, Decision, Report, Task) vem do
 * @operaia/employee-framework. Aqui ficam apenas as estruturas de trabalho
 * do planner/prioritizer/reviewer.
 */

export const CeoPlanAction = {
  ANALYZE_WORKSPACE: "ANALYZE_WORKSPACE",
  REVIEW_PENDING: "REVIEW_PENDING",
  CREATE_TASKS: "CREATE_TASKS",
  UPDATE_ROADMAP: "UPDATE_ROADMAP",
  DELEGATE: "DELEGATE",
  REPORT: "REPORT",
} as const;
export type CeoPlanAction =
  (typeof CeoPlanAction)[keyof typeof CeoPlanAction];

export interface CeoPlanStep {
  readonly order: number;
  readonly action: CeoPlanAction;
  readonly title: string;
  readonly rationale: string;
}

export interface CeoPlan {
  readonly objective: string;
  readonly steps: readonly CeoPlanStep[];
}

export interface PrioritizedTask {
  readonly taskId: string;
  readonly title: string;
  readonly score: number;
  readonly priority: Priority;
  readonly rationale: string;
}

export interface CeoReview {
  readonly objectiveAchieved: boolean;
  readonly pendingCount: number;
  readonly blockedCount: number;
  readonly needsNewCycle: boolean;
  readonly findings: readonly string[];
}
