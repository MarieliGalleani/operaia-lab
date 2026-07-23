import type { WorkspaceSnapshot } from "@operaia/employee-framework";
import { toWorkspaceSnapshotFromRecord } from "./workspace-mappers.js";
import type {
  OfficeWorkspaceRecord,
  WorkspaceSource,
} from "./workspace-source.js";

/** Fonte em memoria para testes — mesmo contrato do source Prisma. */
export class InMemoryWorkspaceSource implements WorkspaceSource {
  constructor(private readonly records: readonly OfficeWorkspaceRecord[]) {}

  async listWorkspaces(): Promise<readonly OfficeWorkspaceRecord[]> {
    return this.records;
  }

  async getWorkspace(
    workspaceId: string,
  ): Promise<OfficeWorkspaceRecord | undefined> {
    const key = workspaceId.toLowerCase();
    return this.records.find(
      (workspace) =>
        workspace.id.toLowerCase() === key ||
        workspace.projectId === workspaceId ||
        workspace.name.toLowerCase() === key,
    );
  }

  async toSnapshot(
    workspaceId: string,
  ): Promise<WorkspaceSnapshot | undefined> {
    const workspace = await this.getWorkspace(workspaceId);
    return workspace ? toWorkspaceSnapshotFromRecord(workspace) : undefined;
  }
}
