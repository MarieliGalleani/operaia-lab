import type { Workspace } from "../workspace/workspace.js";

/**
 * Porta de leitura de Workspaces. Separa "carregar" (read model) de
 * "persistir" (WorkspaceStore). Um default pode delegar para o store.
 */
export interface WorkspaceLoader {
  load(workspaceId: string): Promise<Workspace | null>;
}
