import type { WorkspaceDTO, WorkspaceTaskDTO } from "@/data/dto";

/**
 * Porta para o **Workspace Runtime**: projetos vivos e suas tarefas.
 * Implementações: mock (seed local) e HTTP (API real).
 */
export interface WorkspaceGateway {
  listWorkspaces(): Promise<readonly WorkspaceDTO[]>;
  getWorkspace(id: string): Promise<WorkspaceDTO | undefined>;
  listTasks(workspaceId?: string): Promise<readonly WorkspaceTaskDTO[]>;
}
