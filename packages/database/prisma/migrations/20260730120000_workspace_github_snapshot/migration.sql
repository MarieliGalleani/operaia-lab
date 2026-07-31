-- Snapshot operacional GitHub por workspace (scan do Operational Supervisor)

CREATE TABLE "workspace_github_snapshots" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "bindingId" TEXT,
  "repository" TEXT NOT NULL,
  "defaultBranch" TEXT NOT NULL,
  "lastCommitSha" TEXT,
  "primaryLanguage" TEXT,
  "openIssuesCount" INTEGER NOT NULL DEFAULT 0,
  "openPullRequestsCount" INTEGER NOT NULL DEFAULT 0,
  "remoteUpdatedAt" TIMESTAMP(3),
  "scannedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workspace_github_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_github_snapshots_workspaceId_repository_key"
  ON "workspace_github_snapshots"("workspaceId", "repository");

CREATE INDEX "workspace_github_snapshots_workspaceId_scannedAt_idx"
  ON "workspace_github_snapshots"("workspaceId", "scannedAt");
