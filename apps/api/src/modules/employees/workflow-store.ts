import type { WorkflowPayload } from "./mission-presenter.js";

/** Ultimo workflow por workspace — auditoria para o escritorio virtual. */
export class WorkflowStore {
  private readonly byWorkspace = new Map<string, WorkflowPayload>();

  save(workflow: WorkflowPayload): void {
    this.byWorkspace.set(workflow.workspaceId, workflow);
  }

  get(workspaceId: string): WorkflowPayload | undefined {
    return this.byWorkspace.get(workspaceId);
  }
}
