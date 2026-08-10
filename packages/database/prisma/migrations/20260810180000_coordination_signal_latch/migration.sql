-- Latch edge-triggered do Operational Supervisor (workspaceId + reason).
-- Unique composto garante acquire atomico sob concorrencia multi-instancia.

CREATE TABLE "coordination_signal_latches" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "latchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coordination_signal_latches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coordination_signal_latches_workspaceId_reason_key"
  ON "coordination_signal_latches"("workspaceId", "reason");

CREATE INDEX "coordination_signal_latches_workspaceId_idx"
  ON "coordination_signal_latches"("workspaceId");
