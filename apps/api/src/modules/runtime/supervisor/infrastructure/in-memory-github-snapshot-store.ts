import { randomUUID } from "node:crypto";
import type {
  GithubSnapshotStore,
  UpsertGithubSnapshotInput,
  WorkspaceGithubSnapshotRecord,
} from "../github-snapshot-store.js";

export class InMemoryGithubSnapshotStore implements GithubSnapshotStore {
  private readonly byKey = new Map<string, WorkspaceGithubSnapshotRecord>();

  async findByWorkspaceRepository(
    workspaceId: string,
    repository: string,
  ): Promise<WorkspaceGithubSnapshotRecord | null> {
    return this.byKey.get(keyOf(workspaceId, repository)) ?? null;
  }

  async upsert(
    input: UpsertGithubSnapshotInput,
  ): Promise<WorkspaceGithubSnapshotRecord> {
    const key = keyOf(input.workspaceId, input.repository);
    const existing = this.byKey.get(key);
    const now = new Date();
    const row: WorkspaceGithubSnapshotRecord = {
      id: existing?.id ?? randomUUID(),
      workspaceId: input.workspaceId,
      bindingId: input.bindingId,
      repository: input.repository.trim().toLowerCase(),
      defaultBranch: input.defaultBranch,
      lastCommitSha: input.lastCommitSha,
      primaryLanguage: input.primaryLanguage,
      openIssuesCount: input.openIssuesCount,
      openPullRequestsCount: input.openPullRequestsCount,
      remoteUpdatedAt: input.remoteUpdatedAt,
      scannedAt: input.scannedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.byKey.set(key, row);
    return row;
  }
}

function keyOf(workspaceId: string, repository: string): string {
  return `${workspaceId}::${repository.trim().toLowerCase()}`;
}
