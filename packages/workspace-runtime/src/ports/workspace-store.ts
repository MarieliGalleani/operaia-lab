import type { Workspace } from "../workspace/workspace.js";

/** Persistencia de Workspaces. Implementacao concreta fica fora do nucleo. */
export interface WorkspaceStore {
  save(workspace: Workspace): Promise<void>;
  load(id: string): Promise<Workspace | null>;
}
