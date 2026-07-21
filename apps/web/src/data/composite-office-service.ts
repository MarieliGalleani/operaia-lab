import type {
  Activity,
  ChatMessage,
  Employee,
  OfficeSummary,
  Project,
  Task,
  Workflow,
} from "@/types/office";
import type { OfficeGateways } from "./gateways/office-gateways";
import {
  toActivity,
  toChatMessage,
  toEmployee,
  toProject,
  toTask,
  toWorkflow,
} from "./mappers";
import type { OfficeService } from "./office-service";
import { plannedHires } from "./presentation";

/**
 * Fachada do escritório sobre os gateways.
 *
 * É o único ponto que orquestra as 5 portas (Workspace Runtime, Employee
 * Registry, Employee Runtime, Sessions, Orchestration Events) e traduz DTOs em
 * modelos de UI. Trocar mock por HTTP é injetar outro `OfficeGateways` — esta
 * classe e todos os componentes permanecem intactos.
 */
export class CompositeOfficeService implements OfficeService {
  constructor(private readonly gateways: OfficeGateways) {}

  async getEmployees(): Promise<readonly Employee[]> {
    const [profiles, statuses] = await Promise.all([
      this.gateways.registry.listProfiles(),
      this.gateways.runtime.getStatuses(),
    ]);
    const statusById = new Map(statuses.map((s) => [s.employeeId, s]));
    const hired = profiles.map((profile) =>
      toEmployee(profile, statusById.get(profile.id)),
    );
    return [...hired, ...plannedHires];
  }

  async getProjects(): Promise<readonly Project[]> {
    const workspaces = await this.gateways.workspaces.listWorkspaces();
    return workspaces.map(toProject);
  }

  async getProject(id: string): Promise<Project | undefined> {
    const workspace = await this.gateways.workspaces.getWorkspace(id);
    return workspace ? toProject(workspace) : undefined;
  }

  async getTasks(): Promise<readonly Task[]> {
    return (await this.gateways.workspaces.listTasks()).map(toTask);
  }

  async getTasksByProject(projectId: string): Promise<readonly Task[]> {
    return (await this.gateways.workspaces.listTasks(projectId)).map(toTask);
  }

  async getActivities(): Promise<readonly Activity[]> {
    return (await this.gateways.events.listEvents()).map(toActivity);
  }

  async getActivitiesByProject(projectId: string): Promise<readonly Activity[]> {
    return (await this.gateways.events.listEvents(projectId)).map(toActivity);
  }

  async getWorkflow(workspaceId: string): Promise<Workflow | undefined> {
    const workflow = await this.gateways.runtime.getWorkflow(workspaceId);
    return workflow ? toWorkflow(workflow) : undefined;
  }

  async getSummary(): Promise<OfficeSummary> {
    const [workspaces, tasks, statuses] = await Promise.all([
      this.gateways.workspaces.listWorkspaces(),
      this.gateways.workspaces.listTasks(),
      this.gateways.runtime.getStatuses(),
    ]);
    return {
      activeProjects: workspaces.filter((w) => w.status === "ACTIVE").length,
      workingEmployees: statuses.filter((s) => s.status === "WORKING").length,
      pendingTasks: tasks.filter((t) => t.status !== "DONE").length,
    };
  }

  async askCeo(question: string): Promise<ChatMessage> {
    const reply = await this.gateways.runtime.ask(
      "operaia-ceo",
      "nexo",
      question,
    );
    return toChatMessage(reply);
  }
}
