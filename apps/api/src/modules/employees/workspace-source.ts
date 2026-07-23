import type { WorkspaceSnapshot } from "@operaia/employee-framework";
import type { EmployeeTask } from "@operaia/employee-framework";

/**
 * Visao de Workspace para o escritorio / Equipe Digital.
 * `id` e o identificador publico (slug estavel ou UUID do Project).
 * `projectId` e sempre o id real do Project no dominio/persistencia.
 */
export interface OfficeWorkspaceRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly objective: string;
  readonly status: "ACTIVE" | "PLANNED" | "PAUSED" | "COMPLETED";
  readonly progress: number;
  readonly teamIds: readonly string[];
  readonly tasks: readonly EmployeeTask[];
}

/**
 * Porta: carrega Workspaces reais (Project + Task) para briefing e listagem.
 * MissionOrchestrator nao conhece esta porta — so recebe WorkspaceSnapshot.
 */
export interface WorkspaceSource {
  listWorkspaces(): Promise<readonly OfficeWorkspaceRecord[]>;
  getWorkspace(workspaceId: string): Promise<OfficeWorkspaceRecord | undefined>;
  toSnapshot(workspaceId: string): Promise<WorkspaceSnapshot | undefined>;
}
