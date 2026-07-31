/**
 * Adapter Prisma — WorkspaceGithubSnapshot.
 */
import { prisma, type WorkspaceGithubSnapshot } from "@operaia/database";
import type {
  GithubSnapshotStore,
  UpsertGithubSnapshotInput,
  WorkspaceGithubSnapshotRecord,
} from "../github-snapshot-store.js";

export class PrismaGithubSnapshotStore implements GithubSnapshotStore {
  async findByWorkspaceRepository(
    workspaceId: string,
    repository: string,
  ): Promise<WorkspaceGithubSnapshotRecord | null> {
    const row = await prisma.workspaceGithubSnapshot.findUnique({
      where: {
        workspaceId_repository: {
          workspaceId,
          repository: repository.trim().toLowerCase(),
        },
      },
    });
    return row ? mapRow(row) : null;
  }

  async upsert(
    input: UpsertGithubSnapshotInput,
  ): Promise<WorkspaceGithubSnapshotRecord> {
    const repository = input.repository.trim().toLowerCase();
    const row = await prisma.workspaceGithubSnapshot.upsert({
      where: {
        workspaceId_repository: {
          workspaceId: input.workspaceId,
          repository,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        bindingId: input.bindingId,
        repository,
        defaultBranch: input.defaultBranch,
        lastCommitSha: input.lastCommitSha,
        primaryLanguage: input.primaryLanguage,
        openIssuesCount: input.openIssuesCount,
        openPullRequestsCount: input.openPullRequestsCount,
        remoteUpdatedAt: input.remoteUpdatedAt,
        scannedAt: input.scannedAt,
      },
      update: {
        bindingId: input.bindingId,
        defaultBranch: input.defaultBranch,
        lastCommitSha: input.lastCommitSha,
        primaryLanguage: input.primaryLanguage,
        openIssuesCount: input.openIssuesCount,
        openPullRequestsCount: input.openPullRequestsCount,
        remoteUpdatedAt: input.remoteUpdatedAt,
        scannedAt: input.scannedAt,
      },
    });
    return mapRow(row);
  }
}

function mapRow(row: WorkspaceGithubSnapshot): WorkspaceGithubSnapshotRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    bindingId: row.bindingId,
    repository: row.repository,
    defaultBranch: row.defaultBranch,
    lastCommitSha: row.lastCommitSha,
    primaryLanguage: row.primaryLanguage,
    openIssuesCount: row.openIssuesCount,
    openPullRequestsCount: row.openPullRequestsCount,
    remoteUpdatedAt: row.remoteUpdatedAt,
    scannedAt: row.scannedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
