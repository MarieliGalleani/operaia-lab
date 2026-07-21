import type { WorkspaceSession } from "../workspace/workspace-session.js";

/** Persistencia de sessoes de workspace. */
export interface SessionStore {
  save(session: WorkspaceSession): Promise<void>;
  load(id: string): Promise<WorkspaceSession | null>;
  listByWorkspace(workspaceId: string): Promise<readonly WorkspaceSession[]>;
}
