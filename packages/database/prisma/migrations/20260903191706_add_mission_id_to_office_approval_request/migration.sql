-- AlterTable
ALTER TABLE "office_approval_requests" ADD COLUMN     "missionId" TEXT;

-- CreateIndex
CREATE INDEX "office_approval_requests_missionId_idx" ON "office_approval_requests"("missionId");

-- RenameIndex
ALTER INDEX "operational_memory_notes_workspaceId_sourceType_sourceId_kind_k" RENAME TO "operational_memory_notes_workspaceId_sourceType_sourceId_ki_key";

-- RenameIndex
ALTER INDEX "work_governance_decisions_workspaceId_workIdentity_createdAt_id" RENAME TO "work_governance_decisions_workspaceId_workIdentity_createdA_idx";

-- RenameIndex
ALTER INDEX "workspace_source_bindings_workspaceId_sourceType_externalRef_ke" RENAME TO "workspace_source_bindings_workspaceId_sourceType_externalRe_key";
