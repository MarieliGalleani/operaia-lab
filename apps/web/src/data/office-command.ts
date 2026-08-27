/**
 * Contratos oficiais P0.3B/P0.3D — Command Center / Automation Office.
 * Espelham a UX Spec. Consumidos via `/office/*` (Automation Office).
 */

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

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "MODIFIED";

/** Origem dos dados — transparência P0.3D. */
export type DataSource = "api" | "mapped-status" | "mock-temporary";

export interface AttentionItem {
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

export interface WorkProgressItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly objective: string;
  readonly stepLabel: string;
  readonly progressLabel: string;
  readonly risk: RiskLevel;
  readonly href: string;
  readonly etaLabel?: string;
}

export interface DecisionSummaryItem {
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

export interface CompletedItem {
  readonly id: string;
  readonly title: string;
  readonly finishedAt: string | null;
  readonly kind: string;
  readonly href: string;
  readonly workspaceName?: string;
}

export interface CommandCenterDto {
  readonly generatedAt: string;
  readonly source: DataSource;
  readonly backendDependency: boolean;
  readonly status: {
    readonly level: OfficeLevel;
    readonly label: string;
    readonly summary: string;
  };
  readonly attention: readonly AttentionItem[];
  readonly pendingApprovals: number;
  readonly inProgress: readonly WorkProgressItem[];
  readonly decisions: readonly DecisionSummaryItem[];
  readonly completed: readonly CompletedItem[];
  readonly idle: boolean;
  readonly zeroMessage: string;
}

export interface DemandBrief {
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

export interface WorkPlanStep {
  readonly id: string;
  readonly title: string;
  readonly assigneeEmployeeId?: string;
  readonly assigneeLabel?: string;
  readonly dependencies: readonly string[];
  readonly risk: RiskLevel;
  readonly autonomy: AutonomyLevel;
  readonly expectedResult: string;
}

export interface WorkPlan {
  readonly demandId: string;
  readonly steps: readonly WorkPlanStep[];
}

export interface InterpretDemandResponse {
  readonly source: DataSource;
  readonly backendDependency: boolean;
  readonly brief: DemandBrief;
  readonly plan: WorkPlan;
}

export interface ExecuteDemandResponse {
  readonly source: DataSource;
  readonly backendDependency: boolean;
  readonly accepted: boolean;
  readonly message: string;
  readonly demandId: string;
  readonly missionId?: string;
  readonly redirectTo?: string;
}

export interface DecisionOption {
  readonly id: string;
  readonly label: string;
}

export interface DecisionTraceDto {
  readonly decisionId: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly missionId?: string;
  readonly objective: string;
  readonly context: string;
  readonly options: readonly DecisionOption[];
  readonly chosenOptionId: string;
  readonly rationale: string;
  readonly risk: RiskLevel;
  readonly confidence: ConfidenceLevel;
  readonly autonomy: AutonomyLevel;
  readonly impact: string;
  readonly nextAction: string;
  readonly responsibleEmployeeId: string;
  readonly responsibleLabel: string;
  readonly createdAt: string;
}

export interface ApprovalListItem {
  readonly id: string;
  readonly title: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly risk: RiskLevel;
  readonly status: ApprovalStatus;
  readonly createdAt: string;
  readonly actionSummary: string;
}

export interface ApprovalDetailDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly action: string;
  readonly risk: RiskLevel;
  readonly impact: string;
  readonly reason: string;
  readonly planSummary: string;
  readonly validated: readonly string[];
  readonly ifApprove: string;
  readonly ifReject: string;
  readonly officeDecision: string;
  readonly status: ApprovalStatus;
  readonly createdAt: string;
}

export interface ApprovalActionResponse {
  readonly source: DataSource;
  readonly backendDependency: boolean;
  readonly status: ApprovalStatus;
  readonly message: string;
}

export interface AutomationListItem {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly status: AutomationStatus;
  readonly triggerLabel: string;
  readonly autonomy: AutonomyLevel;
  readonly risk: RiskLevel;
  readonly lastExecutionAt: string | null;
  readonly lastSuccess: boolean | null;
}

export interface AutomationDto extends AutomationListItem {
  readonly actions: readonly string[];
  readonly nextExecutionAt: string | null;
  readonly history: readonly {
    readonly executionId: string;
    readonly at: string;
    readonly status: ExecutionStatus;
  }[];
}

export interface ExecutionStepDto {
  readonly id: string;
  readonly label: string;
  readonly status: ExecutionStepStatus;
  readonly responsibleLabel?: string;
  readonly durationMs?: number;
  readonly resultSummary?: string;
  readonly error?: string;
  readonly canRetry?: boolean;
  readonly nextStepLabel?: string;
}

export interface ExecutionListItem {
  readonly id: string;
  readonly automationId: string;
  readonly automationName: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly status: ExecutionStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
}

export interface ExecutionDto extends ExecutionListItem {
  readonly triggerLabel: string;
  readonly steps: readonly ExecutionStepDto[];
}

export interface WorkspaceContextDto {
  readonly workspaceId: string;
  readonly name: string;
  readonly kind: "lab" | "client";
  readonly statusLabel: string;
  readonly automationsActive: number;
  readonly missionsOpen: number;
  readonly decisionsRecent: number;
  readonly approvalsPending: number;
  readonly integrations: readonly {
    readonly id: string;
    readonly label: string;
    readonly configured: boolean;
  }[];
  readonly credentials: readonly {
    readonly id: string;
    readonly label: string;
    readonly configured: boolean;
  }[];
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  CRITICAL: "Crítico",
};

export const AUTONOMY_LABEL: Record<AutonomyLevel, string> = {
  READ_PLAN: "Planejar",
  CONTROLLED: "Controlado",
  AUTONOMOUS: "Autônomo",
  HUMAN_APPROVAL: "Precisa de você",
};

export const AUTOMATION_STATUS_LABEL: Record<AutomationStatus, string> = {
  DRAFT: "Em rascunho",
  PLANNED: "Plano pronto",
  READY: "Pronta para ativar",
  RUNNING: "Executando agora",
  PAUSED: "Pausada",
  FAILED: "Falhou — precisa atenção",
  VALIDATING: "Validando resultado",
  ACTIVE: "Ativa",
  ARCHIVED: "Arquivada",
};

export const TEAM_WORK_STATUS = [
  "IDLE",
  "THINKING",
  "PLANNING",
  "WORKING",
  "BLOCKED",
  "VALIDATING",
  "COMPLETED",
  "ERROR",
] as const;

export type TeamWorkStatus = (typeof TEAM_WORK_STATUS)[number];
