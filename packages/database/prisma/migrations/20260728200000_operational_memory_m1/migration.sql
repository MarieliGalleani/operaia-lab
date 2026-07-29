-- Memory M1.1 — indice recuperavel OperationalMemoryNote (aditivo).
-- Nao altera Mission / MissionLearning / MissionEvent.

CREATE TABLE "operational_memory_notes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "layer" TEXT NOT NULL DEFAULT 'operational',
    "kind" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "missionId" TEXT,
    "learningId" TEXT,
    "statusFinal" TEXT,
    "objective" TEXT,
    "decision" TEXT,
    "resultSummary" TEXT,
    "risksJson" JSONB,
    "nextActionsJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "operational_memory_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operational_memory_notes_workspaceId_sourceType_sourceId_kind_key"
  ON "operational_memory_notes"("workspaceId", "sourceType", "sourceId", "kind");

CREATE INDEX "operational_memory_notes_workspaceId_createdAt_idx"
  ON "operational_memory_notes"("workspaceId", "createdAt");

CREATE INDEX "operational_memory_notes_workspaceId_kind_createdAt_idx"
  ON "operational_memory_notes"("workspaceId", "kind", "createdAt");

CREATE INDEX "operational_memory_notes_workspaceId_expiresAt_idx"
  ON "operational_memory_notes"("workspaceId", "expiresAt");

CREATE INDEX "operational_memory_notes_missionId_idx"
  ON "operational_memory_notes"("missionId");
