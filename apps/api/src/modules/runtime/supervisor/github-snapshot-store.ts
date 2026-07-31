/**
 * Persistencia do snapshot operacional GitHub por workspace.
 */

export interface WorkspaceGithubSnapshotRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly bindingId: string | null;
  readonly repository: string;
  readonly defaultBranch: string;
  readonly lastCommitSha: string | null;
  readonly primaryLanguage: string | null;
  readonly openIssuesCount: number;
  readonly openPullRequestsCount: number;
  readonly remoteUpdatedAt: Date | null;
  readonly scannedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertGithubSnapshotInput {
  readonly workspaceId: string;
  readonly bindingId: string | null;
  readonly repository: string;
  readonly defaultBranch: string;
  readonly lastCommitSha: string | null;
  readonly primaryLanguage: string | null;
  readonly openIssuesCount: number;
  readonly openPullRequestsCount: number;
  readonly remoteUpdatedAt: Date | null;
  readonly scannedAt: Date;
}

export interface GithubSnapshotStore {
  findByWorkspaceRepository(
    workspaceId: string,
    repository: string,
  ): Promise<WorkspaceGithubSnapshotRecord | null>;

  upsert(
    input: UpsertGithubSnapshotInput,
  ): Promise<WorkspaceGithubSnapshotRecord>;
}
