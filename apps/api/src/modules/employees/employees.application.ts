import {
  EmployeeNotFoundError,
  type EmployeeProfile,
} from "@operaia/employee-framework";
import { DeterministicLLMProvider } from "@operaia/ai-core";
import { NotFoundError, type Priority } from "@operaia/shared";
import { MissionOrchestrator } from "./mission-orchestrator.js";
import {
  presentMissionResult,
  type EmployeeReplyPayload,
  type WorkflowPayload,
} from "./mission-presenter.js";
import { createDigitalOffice, type DigitalOffice } from "./office-composition.js";
import {
  mapPriorityForUi,
  mapTaskStatusForUi,
} from "./workspace-mappers.js";
import type {
  OfficeWorkspaceRecord,
  WorkspaceSource,
} from "./workspace-source.js";
import { WorkflowStore } from "./workflow-store.js";

export interface AskEmployeeInput {
  readonly employeeId: string;
  readonly workspaceId: string;
  readonly question: string;
}

export interface AskEmployeeResult {
  readonly reply: EmployeeReplyPayload;
  readonly workflow: WorkflowPayload;
}

export interface EmployeeProfilePayload {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly specialization: string;
  readonly mission: string;
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly limits: readonly string[];
}

export interface EmployeeStatusPayload {
  readonly employeeId: string;
  readonly status: "WORKING" | "AVAILABLE" | "HIRING";
  readonly statusLabel: string;
  readonly lastActivity: string;
}

export interface WorkspacePayload {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly status: string;
  readonly progress: number;
  readonly teamIds: readonly string[];
  readonly decisions: readonly {
    readonly id: string;
    readonly summary: string;
    readonly authorId: string;
    readonly date: string;
  }[];
}

export interface WorkspaceTaskPayload {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly status: "BACKLOG" | "IN_PROGRESS" | "DONE";
  readonly assigneeId?: string;
  readonly priority: Priority;
}

export interface EmployeesApplicationDeps {
  readonly office?: DigitalOffice;
  readonly workflows?: WorkflowStore;
  readonly workspaces: WorkspaceSource;
}

/**
 * Aplicacao da Equipe Digital: WorkspaceSource + MissionOrchestrator +
 * apresentacao. Sem regras de negocio de funcionarios.
 * MissionOrchestrator permanece inalterado.
 */
export class EmployeesApplication {
  private readonly office: DigitalOffice;
  private readonly orchestrator: MissionOrchestrator;
  private readonly workflows: WorkflowStore;
  private readonly workspaces: WorkspaceSource;
  private readonly lastActivity = new Map<string, string>();

  constructor(deps: EmployeesApplicationDeps) {
    this.office =
      deps.office ??
      createDigitalOffice({ llm: new DeterministicLLMProvider() });
    this.orchestrator = new MissionOrchestrator(this.office);
    this.workflows = deps.workflows ?? new WorkflowStore();
    this.workspaces = deps.workspaces;
  }

  listProfiles(): readonly EmployeeProfilePayload[] {
    return this.office.registry.all().map((entry) => toProfileDto(entry.profile));
  }

  getProfile(id: string): EmployeeProfilePayload | undefined {
    try {
      return toProfileDto(this.office.registry.require(id).profile);
    } catch (error) {
      if (error instanceof EmployeeNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }

  listStatuses(): readonly EmployeeStatusPayload[] {
    return this.office.registry.all().map((entry) => {
      const id = entry.profile.id;
      const activity =
        this.lastActivity.get(id) ?? "Aguardando missao no escritorio";
      const isWorking = activity.startsWith("Missao:");
      return {
        employeeId: id,
        status: isWorking ? "WORKING" : "AVAILABLE",
        statusLabel: isWorking ? "Em missao" : "Disponivel",
        lastActivity: activity,
      };
    });
  }

  async listWorkspaces(): Promise<readonly WorkspacePayload[]> {
    const records = await this.workspaces.listWorkspaces();
    return records.map(toWorkspaceDto);
  }

  async getWorkspace(id: string): Promise<WorkspacePayload | undefined> {
    const workspace = await this.workspaces.getWorkspace(id);
    return workspace ? toWorkspaceDto(workspace) : undefined;
  }

  async listTasks(workspaceId?: string): Promise<readonly WorkspaceTaskPayload[]> {
    const records = workspaceId
      ? [await this.workspaces.getWorkspace(workspaceId)].filter(
          (item): item is OfficeWorkspaceRecord => item !== undefined,
        )
      : await this.workspaces.listWorkspaces();

    return records.flatMap((workspace) =>
      workspace.tasks.map((task) => toTaskDto(workspace.id, task)),
    );
  }

  getWorkflow(workspaceId: string): WorkflowPayload | undefined {
    return this.workflows.get(workspaceId);
  }

  async ask(input: AskEmployeeInput): Promise<AskEmployeeResult> {
    const snapshot = await this.workspaces.toSnapshot(input.workspaceId);
    const workspace = await this.workspaces.getWorkspace(input.workspaceId);
    if (!snapshot || !workspace) {
      throw new NotFoundError("Workspace", input.workspaceId);
    }

    try {
      this.office.registry.require(input.employeeId);
    } catch (error) {
      if (error instanceof EmployeeNotFoundError) {
        throw new NotFoundError("Employee", input.employeeId);
      }
      throw error;
    }

    const result = await this.orchestrator.run(input.employeeId, {
      workspace: snapshot,
      objective: input.question,
    });

    const presented = presentMissionResult(
      result,
      input.workspaceId,
      workspace.name,
    );
    this.workflows.save(presented.workflow);

    this.lastActivity.set(
      result.final.employeeId,
      `Missao: ${input.question.slice(0, 80)}`,
    );
    for (const outcome of result.outcomes) {
      if (outcome.employeeId) {
        this.lastActivity.set(
          outcome.employeeId,
          `Missao delegada: ${outcome.request.reason}`,
        );
      }
    }

    return presented;
  }
}

function toProfileDto(profile: EmployeeProfile): EmployeeProfilePayload {
  return {
    id: profile.id,
    name: profile.id === "operaia-ceo" ? "Opera" : profile.name,
    role:
      profile.specialization === "MANAGEMENT"
        ? "CEO"
        : profile.specialization === "SOFTWARE_ENGINEERING"
          ? "CTO"
          : profile.role,
    specialization: profile.specialization,
    mission: profile.mission,
    capabilities: profile.capabilities,
    permissions: profile.permissions,
    limits: profile.limits,
  };
}

function toWorkspaceDto(workspace: OfficeWorkspaceRecord): WorkspacePayload {
  return {
    id: workspace.id,
    name: workspace.name,
    objective: workspace.objective,
    status: workspace.status,
    progress: workspace.progress,
    teamIds: workspace.teamIds,
    decisions: [],
  };
}

function toTaskDto(
  workspaceId: string,
  task: OfficeWorkspaceRecord["tasks"][number],
): WorkspaceTaskPayload {
  const urgency = task.urgency ?? 2;
  const priority: Priority =
    urgency >= 5 ? "URGENT" : urgency >= 4 ? "HIGH" : urgency >= 3 ? "MEDIUM" : "LOW";

  return {
    id: task.id,
    workspaceId,
    title: task.title,
    status: mapTaskStatusForUi(task.status),
    priority: mapPriorityForUi(priority),
  };
}
