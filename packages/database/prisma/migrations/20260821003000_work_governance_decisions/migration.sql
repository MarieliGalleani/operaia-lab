-- Work Governance Gate — Decision Ledger append-only
CREATE TABLE IF NOT EXISTS "work_governance_decisions" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "workIdentity" TEXT NOT NULL,
    "contextFingerprint" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "authority" TEXT NOT NULL DEFAULT 'AlreadyDoneGate',
    "resultingMissionId" TEXT,
    "evidencesJson" JSONB,
    "forceExecute" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_governance_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "work_governance_decisions_correlationId_key"
  ON "work_governance_decisions"("correlationId");

CREATE INDEX IF NOT EXISTS "work_governance_decisions_workspaceId_workIdentity_createdAt_idx"
  ON "work_governance_decisions"("workspaceId", "workIdentity", "createdAt");

CREATE INDEX IF NOT EXISTS "work_governance_decisions_createdAt_idx"
  ON "work_governance_decisions"("createdAt");
