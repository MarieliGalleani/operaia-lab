import type { WorkspaceLoader } from "../ports/workspace-loader.js";
import type { WorkspaceStore } from "../ports/workspace-store.js";
import type { Workspace } from "../workspace/workspace.js";

/** Store em memoria. Serve tambem como WorkspaceLoader (ambos expoem load). */
export class InMemoryWorkspaceStore implements WorkspaceStore, WorkspaceLoader {
  private readonly workspaces = new Map<string, Workspace>();

  constructor(initial: readonly Workspace[] = []) {
    for (const workspace of initial) {
      this.workspaces.set(workspace.id, workspace);
    }
  }

  async save(workspace: Workspace): Promise<void> {
    this.workspaces.set(workspace.id, workspace);
  }

  async load(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) ?? null;
  }
}
