/**
 * Contratos de dominio do Virtual Office.
 *
 * Estes tipos espelham as entidades do backend (Employee Registry, Workspace
 * Runtime, Sessions) para que a troca de dados mockados por API real seja
 * apenas uma nova implementacao de `OfficeService` — sem tocar na UI.
 */

/** Especialidades de negocio (alinhadas ao Employee Framework). */
export type Specialization =
  | "MANAGEMENT"
  | "SOFTWARE_ENGINEERING"
  | "PRODUCT_DESIGN"
  | "PRODUCT_MANAGEMENT"
  | "AUTOMATION"
  | "MARKETING"
  | "FINANCE"
  | "LEGAL"
  | "OPERATIONS"
  | "UX_DESIGN"
  | "PRODUCT"
  | "COMMERCIAL";

/** Situacao operacional de um funcionario no escritorio. */
export type EmployeeStatus = "WORKING" | "AVAILABLE" | "HIRING";

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly emoji: string;
  readonly specialization: Specialization;
  readonly specialtyLabel: string;
  readonly mission: string;
  readonly status: EmployeeStatus;
  readonly statusLabel: string;
  readonly lastActivity: string;
  /** false = vaga preparada, ainda nao contratada (Luna, Atlas, ...). */
  readonly active: boolean;
}

export type ProjectStatus = "ACTIVE" | "PLANNED" | "PAUSED" | "COMPLETED";

export interface ProjectDecision {
  readonly id: string;
  readonly summary: string;
  readonly authorId: string;
  readonly date: string;
}

/** Um projeto vivo = um Workspace no backend. */
export interface Project {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly status: ProjectStatus;
  readonly progress: number;
  readonly teamIds: readonly string[];
  readonly decisions: readonly ProjectDecision[];
}

export type TaskStatus = "BACKLOG" | "IN_PROGRESS" | "DONE";

export interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly assigneeId?: string;
  readonly priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export type ActivityKind =
  | "PLAN"
  | "BRIEFING"
  | "TASK"
  | "REVIEW"
  | "DELEGATION";

export interface Activity {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly actorId: string;
  readonly message: string;
  readonly timestamp: string;
  readonly projectId?: string;
}

export type ChatAuthor = "ceo" | "user";

/** Resposta executiva estruturada do CEO (Resumo | Projetos | Riscos | Acoes). */
export interface ExecutiveAnswer {
  readonly summary: string;
  readonly projects: readonly string[];
  readonly risks: readonly string[];
  readonly nextActions: readonly string[];
}

export interface ChatMessage {
  readonly id: string;
  readonly author: ChatAuthor;
  readonly authorName: string;
  readonly content: string;
  readonly timestamp: string;
  readonly answer?: ExecutiveAnswer;
}

/** Resumo agregado da home do escritorio. */
export interface OfficeSummary {
  readonly activeProjects: number;
  readonly workingEmployees: number;
  readonly pendingTasks: number;
}

/** Estagios canonicos do trabalho coordenado (fluxo de delegacao visual). */
export type WorkflowStage =
  | "THINKING"
  | "ANALYZING"
  | "DELEGATING"
  | "EXECUTING"
  | "REVIEWING"
  | "DONE";

export type WorkflowStepStatus = "done" | "current" | "pending";

export interface WorkflowStep {
  readonly stage: WorkflowStage;
  readonly actorId: string;
  readonly detail: string;
  readonly status: WorkflowStepStatus;
  readonly timestamp?: string;
}

/** Um fluxo de trabalho em um Workspace (ex.: delegacao CEO -> especialista). */
export interface Workflow {
  readonly workspaceId: string;
  readonly title: string;
  readonly steps: readonly WorkflowStep[];
}
