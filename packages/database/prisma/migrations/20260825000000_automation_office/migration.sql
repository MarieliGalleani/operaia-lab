-- Automation Office (P0.3C) — camada de intencao/coordenacao UX

CREATE TYPE "OfficeDemandStatus" AS ENUM (
  'DRAFT',
  'INTERPRETING',
  'PLANNED',
  'AWAITING_APPROVAL',
  'READY',
  'EXECUTING',
  'VALIDATING',
  'COMPLETED',
  'PAUSED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "OfficeRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "OfficeAutonomyLevel" AS ENUM (
  'READ_PLAN',
  'CONTROLLED',
  'AUTONOMOUS',
  'HUMAN_APPROVAL'
);

CREATE TYPE "OfficePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "OfficeApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'MODIFIED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "OfficeConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE "OfficeAutomationStatus" AS ENUM (
  'DRAFT',
  'PLANNED',
  'READY',
  'RUNNING',
  'PAUSED',
  'FAILED',
  'VALIDATING',
  'ACTIVE',
  'ARCHIVED'
);

CREATE TABLE "office_demands" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "status" "OfficeDemandStatus" NOT NULL DEFAULT 'DRAFT',
  "objective" TEXT NOT NULL,
  "context" TEXT NOT NULL DEFAULT '',
  "expectedOutcome" TEXT NOT NULL DEFAULT '',
  "constraintsJson" JSONB NOT NULL DEFAULT '[]',
  "priority" "OfficePriority" NOT NULL DEFAULT 'MEDIUM',
  "risk" "OfficeRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "autonomy" "OfficeAutonomyLevel" NOT NULL DEFAULT 'CONTROLLED',
  "planJson" JSONB,
  "missionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "office_demands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "office_approval_requests" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "demandId" TEXT,
  "action" TEXT NOT NULL,
  "risk" "OfficeRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "impact" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "validatedJson" JSONB NOT NULL DEFAULT '[]',
  "approveEffect" TEXT NOT NULL,
  "rejectEffect" TEXT NOT NULL,
  "officeDecision" TEXT NOT NULL DEFAULT '',
  "status" "OfficeApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,

  CONSTRAINT "office_approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "office_decision_traces" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "missionId" TEXT,
  "objective" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "optionsJson" JSONB NOT NULL,
  "chosenOptionId" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "risk" "OfficeRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "confidence" "OfficeConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
  "autonomy" "OfficeAutonomyLevel" NOT NULL DEFAULT 'CONTROLLED',
  "impact" TEXT NOT NULL,
  "nextAction" TEXT NOT NULL,
  "responsibleEmployeeId" TEXT NOT NULL DEFAULT 'opera',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "office_decision_traces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "office_automations" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "triggerConfigJson" JSONB NOT NULL DEFAULT '{}',
  "actionsJson" JSONB NOT NULL DEFAULT '[]',
  "autonomy" "OfficeAutonomyLevel" NOT NULL DEFAULT 'CONTROLLED',
  "risk" "OfficeRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "status" "OfficeAutomationStatus" NOT NULL DEFAULT 'DRAFT',
  "lastExecutionMissionId" TEXT,
  "lastExecutionAt" TIMESTAMP(3),
  "nextExecutionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "office_automations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "office_demands_workspaceId_status_idx" ON "office_demands"("workspaceId", "status");
CREATE INDEX "office_demands_workspaceId_createdAt_idx" ON "office_demands"("workspaceId", "createdAt");

CREATE INDEX "office_approval_requests_workspaceId_status_idx" ON "office_approval_requests"("workspaceId", "status");
CREATE INDEX "office_approval_requests_demandId_idx" ON "office_approval_requests"("demandId");

CREATE INDEX "office_decision_traces_workspaceId_createdAt_idx" ON "office_decision_traces"("workspaceId", "createdAt");
CREATE INDEX "office_decision_traces_missionId_idx" ON "office_decision_traces"("missionId");

CREATE INDEX "office_automations_workspaceId_status_idx" ON "office_automations"("workspaceId", "status");

ALTER TABLE "office_approval_requests"
  ADD CONSTRAINT "office_approval_requests_demandId_fkey"
  FOREIGN KEY ("demandId") REFERENCES "office_demands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
