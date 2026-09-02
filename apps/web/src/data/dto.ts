/**
 * DTOs — o formato "de fio" retornado por cada sistema do backend.
 *
 * São propositalmente separados dos modelos de UI (`types/office.ts`): os
 * gateways falam em DTOs (o que a API entrega) e os mappers traduzem para os
 * modelos que os componentes consomem. Assim, uma mudança no formato da API é
 * absorvida nos mappers, sem tocar em componentes.
 */
import type {
  ActivityKind,
  EmployeeStatus,
  ExecutiveAnswer,
  ProjectStatus,
  Specialization,
  TaskStatus,
  WorkflowStage,
  WorkflowStepStatus,
} from "@/types/office";

/** Employee Registry — perfil declarativo (espelha o EmployeeProfile do framework). */
export interface EmployeeProfileDTO {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly specialization: Specialization;
  readonly status?: EmployeeStatus;
  readonly version?: string;
  readonly executable?: true;
  readonly mission: string;
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly limits: readonly string[];
}

/** Employee Runtime — situação operacional (quem está trabalhando agora). */
export interface EmployeeStatusDTO {
  readonly employeeId: string;
  readonly status: EmployeeStatus;
  readonly statusLabel: string;
  readonly lastActivity: string;
}

/** Employee Runtime — resposta de um funcionário (ex.: CEO no chat executivo). */
export interface EmployeeReplyDTO {
  readonly employeeId: string;
  readonly content: string;
  readonly answer: ExecutiveAnswer;
}

/** Workspace Runtime — projeto vivo. */
export interface WorkspaceDecisionDTO {
  readonly id: string;
  readonly summary: string;
  readonly authorId: string;
  readonly date: string;
}

export interface WorkspaceDTO {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly status: ProjectStatus;
  readonly progress: number;
  readonly teamIds: readonly string[];
  readonly decisions: readonly WorkspaceDecisionDTO[];
  /** P1.14B — contexto operacional real do Project (distinto de `objective`). */
  readonly projectObjective: string | null;
  readonly projectContext: string | null;
  readonly projectConstraints: string | null;
}

export interface WorkspaceTaskDTO {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly assigneeId?: string;
  readonly priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

/** Sessions — uma execução de objetivo dentro de um Workspace. */
export interface SessionDTO {
  readonly id: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly status: string;
  readonly currentCycle: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
}

export interface SessionStateDTO extends SessionDTO {
  readonly executionSummary: unknown;
  readonly history: readonly unknown[];
}

/** Orchestration Events — eventos do ciclo de vida coordenado. */
export interface OrchestrationEventDTO {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly actorId: string;
  readonly message: string;
  readonly timestamp: string;
  readonly workspaceId?: string;
}

/** Runtime — item de GET /api/v1/missions?format=flat (contrato existente). */
export interface MissionListItemDTO {
  readonly id: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly missionKind: string;
  readonly status: string;
  readonly ownerEmployeeId: string;
  readonly createdAt: string;
  readonly finishedAt?: string | null;
  /**
   * Presentes no payload real (Prisma retorna todas as colunas sem
   * select explicito em MissionQueue.list) mas ausentes do contrato
   * antigo. origin so e preenchido em missoes RAIZ (P1.2B).
   */
  readonly origin?: string | null;
  readonly parentMissionId?: string | null;
  readonly progress?: number;
}

/** Employee Runtime — fluxo de trabalho/delegacao de um Workspace. */
export interface WorkflowStepDTO {
  readonly stage: WorkflowStage;
  readonly actorId: string;
  readonly detail: string;
  readonly status: WorkflowStepStatus;
  readonly timestamp?: string;
}

export interface WorkflowDTO {
  readonly workspaceId: string;
  readonly title: string;
  readonly steps: readonly WorkflowStepDTO[];
}
