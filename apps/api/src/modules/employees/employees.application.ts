import {
  EmployeeNotFoundError,
  type EmployeeProfile,
} from "@operaia/employee-framework";
import { DeterministicLLMProvider, RecordingLLMObserver } from "@operaia/ai-core";
import { NotFoundError, type Priority } from "@operaia/shared";
import { InMemoryMemoryStore } from "@operaia/workspace-runtime";
import { createMissionExecutionStack } from "../operations/mission-execution.js";
import { OperationalMissionService } from "../operations/operational-mission-service.js";
import { OperationalRunStore } from "../operations/operational-run-store.js";
import type {
  EmployeeReplyPayload,
  WorkflowPayload,
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
  /** ID do OperationalRun — mesmo registro que Operations. */
  readonly missionId: string;
}

export interface EmployeeProfilePayload {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly specialization: string;
  readonly status: "WORKING" | "AVAILABLE" | "HIRING";
  readonly version: string;
  readonly executable: true;
  readonly mission: string;
  capabilities: string[];
  permissions: string[];
  limits: string[];
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
  teamIds: string[];
  decisions: Array<{
    id: string;
    summary: string;
    authorId: string;
    date: string;
  }>;
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
  /**
   * Fonte unica de execucao de missao (Operations + Sala da CEO).
   * Se omitido, cria um OperationalMissionService local (testes isolados).
   */
  readonly missions?: OperationalMissionService;
}

/**
 * Aplicacao da Equipe Digital: catalogo + apresentacao.
 * Execucao de missao: sempre via OperationalMissionService (unica fonte).
 */
export class EmployeesApplication {
  private readonly office: DigitalOffice;
  private readonly workflows: WorkflowStore;
  private readonly workspaces: WorkspaceSource;
  private readonly missions: OperationalMissionService;
  private readonly lastActivity = new Map<string, string>();

  constructor(deps: EmployeesApplicationDeps) {
    this.office =
      deps.office ??
      createDigitalOffice({ llm: new DeterministicLLMProvider() });
    this.workflows = deps.workflows ?? new WorkflowStore();
    this.workspaces = deps.workspaces;
    this.missions =
      deps.missions ??
      new OperationalMissionService(
        this.office,
        this.workspaces,
        new RecordingLLMObserver(),
        new OperationalRunStore(),
        new InMemoryMemoryStore(),
        createMissionExecutionStack(),
      );
  }

  /** Acesso ao servico de missao (testes / igualdade de canais). */
  get missionService(): OperationalMissionService {
    return this.missions;
  }

  listProfiles(): EmployeeProfilePayload[] {
    const statusById = new Map(
      this.listStatuses().map((entry) => [entry.employeeId, entry]),
    );
    return this.office.registry.all().map((entry) =>
      toProfileDto(entry.profile, statusById.get(entry.profile.id)),
    );
  }

  getProfile(id: string): EmployeeProfilePayload | undefined {
    try {
      const profile = this.office.registry.require(id).profile;
      const status = this.listStatuses().find((entry) => entry.employeeId === id);
      return toProfileDto(profile, status);
    } catch (error) {
      if (error instanceof EmployeeNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }

  listStatuses(): EmployeeStatusPayload[] {
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

  async listWorkspaces(): Promise<WorkspacePayload[]> {
    const records = await this.workspaces.listWorkspaces();
    return records.map(toWorkspaceDto);
  }

  async getWorkspace(id: string): Promise<WorkspacePayload | undefined> {
    const workspace = await this.workspaces.getWorkspace(id);
    return workspace ? toWorkspaceDto(workspace) : undefined;
  }

  async listTasks(workspaceId?: string): Promise<WorkspaceTaskPayload[]> {
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

  /**
   * Sala da CEO: mesma execucao que Operations (OperationalMissionService).
   * Retorno HTTP publico permanece `reply` — missionId e interno/testes.
   */
  async ask(input: AskEmployeeInput): Promise<AskEmployeeResult> {
    try {
      this.office.registry.require(input.employeeId);
    } catch (error) {
      if (error instanceof EmployeeNotFoundError) {
        throw new NotFoundError("Employee", input.employeeId);
      }
      throw error;
    }

    let run;
    try {
      run = await this.missions.run({
        workspaceId: input.workspaceId,
        objective: input.question,
        employeeId: input.employeeId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Workspace nao encontrado")
      ) {
        throw new NotFoundError("Workspace", input.workspaceId);
      }
      throw error;
    }

    this.workflows.save(run.workflow);

    this.lastActivity.set(
      run.mission.final.employeeId,
      `Missao: ${input.question.slice(0, 80)}`,
    );
    for (const outcome of run.mission.outcomes) {
      if (outcome.employeeId) {
        this.lastActivity.set(
          outcome.employeeId,
          `Missao delegada: ${outcome.request.reason}`,
        );
      }
    }

    return {
      reply: run.reply,
      workflow: run.workflow,
      missionId: run.id,
    };
  }
}

function toProfileDto(
  profile: EmployeeProfile,
  status?: EmployeeStatusPayload,
): EmployeeProfilePayload {
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    specialization: profile.specialization,
    status: status?.status ?? "AVAILABLE",
    version: profile.version ?? "1.0.0",
    executable: true,
    mission: profile.mission,
    capabilities: [...profile.capabilities],
    permissions: [...profile.permissions],
    limits: [...profile.limits],
  };
}

function toWorkspaceDto(workspace: OfficeWorkspaceRecord): WorkspacePayload {
  return {
    id: workspace.id,
    name: workspace.name,
    objective: workspace.objective,
    status: workspace.status,
    progress: workspace.progress,
    teamIds: [...workspace.teamIds],
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
