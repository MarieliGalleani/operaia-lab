-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PROPOSED', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'IMPLEMENTING', 'COMPLETED');

-- CreateTable
CREATE TABLE "change_proposals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "evidenceJson" JSONB,
    "expectedImpact" TEXT NOT NULL,
    "affectedComponents" JSONB NOT NULL,
    "risksJson" JSONB,
    "implementationPlan" TEXT NOT NULL,
    "rollbackPlan" TEXT NOT NULL,
    "diffRef" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PROPOSED',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "change_proposals_approvalStatus_createdAt_idx" ON "change_proposals"("approvalStatus", "createdAt");
CREATE INDEX "change_proposals_projectId_idx" ON "change_proposals"("projectId");
