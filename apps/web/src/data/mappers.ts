import type {
  EmployeeProfileDTO,
  EmployeeReplyDTO,
  EmployeeStatusDTO,
  OrchestrationEventDTO,
  WorkflowDTO,
  WorkspaceDTO,
  WorkspaceTaskDTO,
} from "@/data/dto";
import { presentationFor } from "@/data/presentation";
import type {
  Activity,
  ChatMessage,
  Employee,
  Project,
  Task,
  Workflow,
} from "@/types/office";

/** Perfil (registry) + status (runtime) -> funcionário exibível. */
export function toEmployee(
  profile: EmployeeProfileDTO,
  status?: EmployeeStatusDTO,
): Employee {
  const presentation = presentationFor(profile.specialization);
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    emoji: presentation.emoji,
    specialization: profile.specialization,
    specialtyLabel: presentation.specialtyLabel,
    mission: profile.mission,
    status: status?.status ?? "AVAILABLE",
    statusLabel: status?.statusLabel ?? "Disponível",
    lastActivity: status?.lastActivity ?? "—",
    active: true,
  };
}

export function toProject(dto: WorkspaceDTO): Project {
  return {
    id: dto.id,
    name: dto.name,
    objective: dto.objective,
    status: dto.status,
    progress: dto.progress,
    teamIds: dto.teamIds,
    decisions: dto.decisions.map((decision) => ({
      id: decision.id,
      summary: decision.summary,
      authorId: decision.authorId,
      date: decision.date,
    })),
  };
}

export function toTask(dto: WorkspaceTaskDTO): Task {
  return {
    id: dto.id,
    projectId: dto.workspaceId,
    title: dto.title,
    status: dto.status,
    assigneeId: dto.assigneeId,
    priority: dto.priority,
  };
}

export function toActivity(dto: OrchestrationEventDTO): Activity {
  return {
    id: dto.id,
    kind: dto.kind,
    actorId: dto.actorId,
    message: dto.message,
    timestamp: dto.timestamp,
    projectId: dto.workspaceId,
  };
}

export function toWorkflow(dto: WorkflowDTO): Workflow {
  return {
    workspaceId: dto.workspaceId,
    title: dto.title,
    steps: dto.steps.map((step) => ({
      stage: step.stage,
      actorId: step.actorId,
      detail: step.detail,
      status: step.status,
      timestamp: step.timestamp,
    })),
  };
}

const EMPLOYEE_DISPLAY_NAME: Record<string, string> = {
  "operaia-ceo": "CEO — Opera",
  "cto-mag": "CTO — Mag",
};

export function toChatMessage(reply: EmployeeReplyDTO): ChatMessage {
  return {
    id: `msg-${Date.now()}`,
    author: "ceo",
    authorName: EMPLOYEE_DISPLAY_NAME[reply.employeeId] ?? reply.employeeId,
    content: reply.content,
    timestamp: new Date().toISOString(),
    answer: reply.answer,
  };
}
