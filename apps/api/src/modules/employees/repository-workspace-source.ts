import type { ProjectRepository } from "../projects/domain/project.repository.js";
import type { TaskRepository } from "../tasks/domain/task.repository.js";
import {
  buildOfficeWorkspace,
  resolveProjectNameFromSlug,
  toWorkspaceSnapshotFromRecord,
} from "./workspace-mappers.js";
import type {
  OfficeWorkspaceRecord,
  WorkspaceSource,
} from "./workspace-source.js";

const DEFAULT_TEAM = ["operaia-ceo", "cto-mag"] as const;

/**
 * Carrega Workspaces a partir dos repositorios de Project/Task existentes.
 * Nao cria modelo paralelo — apenas adapta o dominio ja persistido.
 */
export class RepositoryWorkspaceSource implements WorkspaceSource {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly teamIds: readonly string[] = DEFAULT_TEAM,
  ) {}

  async listWorkspaces(): Promise<readonly OfficeWorkspaceRecord[]> {
    const projects = await this.projects.findAll();
    return Promise.all(projects.map((project) => this.toRecord(project.id)));
  }

  async getWorkspace(
    workspaceId: string,
  ): Promise<OfficeWorkspaceRecord | undefined> {
    const project = await this.resolveProject(workspaceId);
    if (!project) {
      return undefined;
    }
    return this.toRecord(project.id);
  }

  async toSnapshot(workspaceId: string) {
    const workspace = await this.getWorkspace(workspaceId);
    return workspace ? toWorkspaceSnapshotFromRecord(workspace) : undefined;
  }

  private async toRecord(projectId: string): Promise<OfficeWorkspaceRecord> {
    const project = await this.projects.findById(projectId);
    if (!project) {
      throw new Error(`Project desapareceu durante carga: ${projectId}`);
    }
    const tasks = await this.tasks.findAll({ projectId: project.id });
    return buildOfficeWorkspace(project, tasks, this.teamIds);
  }

  private async resolveProject(workspaceId: string) {
    const byId = await this.projects.findById(workspaceId);
    if (byId) {
      return byId;
    }
    const name =
      resolveProjectNameFromSlug(workspaceId) ?? workspaceId;
    return this.projects.findByName(name);
  }
}
