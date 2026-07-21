import type { SessionStore } from "../ports/session-store.js";
import type { WorkspaceSession } from "../workspace/workspace-session.js";

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, WorkspaceSession>();

  async save(session: WorkspaceSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async load(id: string): Promise<WorkspaceSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async listByWorkspace(
    workspaceId: string,
  ): Promise<readonly WorkspaceSession[]> {
    return [...this.sessions.values()].filter(
      (session) => session.workspaceId === workspaceId,
    );
  }
}
