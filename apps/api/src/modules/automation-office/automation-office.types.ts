import type { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import type { OperationalRuntime } from "../operations/lab-runtime.js";
import type { AlreadyDoneGate } from "../runtime/work-governance/index.js";
import type { AssistedMissionQueuePort } from "../operations/operational-mission-service.js";

export interface AutomationOfficeDeps {
  readonly runtime: ContinuousRuntime;
  readonly operations: OperationalRuntime;
  readonly workGovernanceGate: AlreadyDoneGate;
  readonly queue: AssistedMissionQueuePort;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AutonomyLevel =
  | "READ_PLAN"
  | "CONTROLLED"
  | "AUTONOMOUS"
  | "HUMAN_APPROVAL";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";
export type OfficeLevel = "OPERATING" | "ATTENTION" | "PROBLEM";
export type AttentionSeverity = "blocker" | "critical" | "warning" | "info";
export type AttentionKind =
  | "approval"
  | "block"
  | "failure"
  | "credential"
  | "risk"
  | "decision";
export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "MODIFIED"
  | "EXPIRED"
  | "CANCELLED";
export type AutomationStatus =
  | "DRAFT"
  | "PLANNED"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "FAILED"
  | "VALIDATING"
  | "ACTIVE"
  | "ARCHIVED";
export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";
export type ExecutionStepStatus =
  | "pending"
  | "running"
  | "ok"
  | "failed"
  | "skipped"
  | "waiting";

export interface WorkPlanStepDto {
  readonly id: string;
  readonly title: string;
  readonly assigneeEmployeeId?: string;
  readonly assigneeLabel?: string;
  readonly dependencies: readonly string[];
  readonly risk: RiskLevel;
  readonly autonomy: AutonomyLevel;
  readonly expectedResult: string;
}

export interface WorkPlanDto {
  readonly demandId: string;
  readonly steps: readonly WorkPlanStepDto[];
}

export interface DemandBriefDto {
  readonly demandId: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly objective: string;
  readonly context: string;
  readonly expectedOutcome: string;
  readonly constraints: readonly string[];
  readonly priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  readonly risk: RiskLevel;
  readonly autonomy: AutonomyLevel;
  readonly dependencies: readonly string[];
}

export interface AttentionItemDto {
  readonly id: string;
  readonly kind: AttentionKind;
  readonly severity: AttentionSeverity;
  readonly title: string;
  readonly detail: string;
  readonly workspaceId?: string;
  readonly workspaceName?: string;
  readonly risk?: RiskLevel;
  readonly href: string;
}

export interface WorkProgressItemDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly objective: string;
  readonly ownerEmployeeId: string;
  readonly stepLabel: string;
  readonly progressLabel: string;
  readonly risk: RiskLevel;
  readonly href: string;
  readonly etaLabel?: string;
}

export interface DecisionSummaryItemDto {
  readonly id: string;
  readonly title: string;
  readonly rationale: string;
  readonly risk: RiskLevel;
  readonly confidence: ConfidenceLevel;
  readonly autonomy: AutonomyLevel;
  readonly nextAction: string;
  readonly createdAt: string;
  readonly workspaceName?: string;
}

export interface CompletedItemDto {
  readonly id: string;
  readonly title: string;
  readonly finishedAt: string | null;
  readonly kind: string;
  readonly href: string;
  readonly workspaceName?: string;
  /**
   * Especialista(s) cuja missão EXECUTE filha teve
   * resultJson.delivery.status === "DELIVERED". Pode ter mais de um
   * (delegação múltipla) ou nenhum (Opera respondeu sem delegar/sem
   * delivery estruturado) — nunca escolhemos um "principal" arbitrário.
   */
  readonly deliveredByEmployeeIds: readonly string[];
}

export interface TeamMemberDto {
  readonly employeeId: string;
  readonly name: string;
  readonly specialization: string;
  readonly status: string;
  readonly currentMissionId: string | null;
  readonly currentObjective: string | null;
}

export interface CommandCenterDto {
  readonly generatedAt: string;
  readonly source: "api";
  readonly backendDependency: false;
  readonly status: {
    readonly level: OfficeLevel;
    readonly label: string;
    readonly summary: string;
    readonly workers: {
      readonly alive: number;
      readonly expected: number;
      readonly busy: number;
      readonly available: number;
    };
  };
  readonly attention: readonly AttentionItemDto[];
  readonly pendingApprovals: number;
  readonly inProgress: readonly WorkProgressItemDto[];
  readonly decisions: readonly DecisionSummaryItemDto[];
  readonly completed: readonly CompletedItemDto[];
  readonly team: readonly TeamMemberDto[];
  readonly idle: boolean;
  readonly zeroMessage: string;
}
