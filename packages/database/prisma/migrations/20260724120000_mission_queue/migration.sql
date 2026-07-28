-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('CREATED', 'QUEUED', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "objective" TEXT NOT NULL,
    "objectiveHash" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MissionStatus" NOT NULL DEFAULT 'CREATED',
    "ownerEmployeeId" TEXT NOT NULL,
    "requiredSpecialization" TEXT,
    "parentMissionId" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_events" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentMissionId" TEXT,
    "metricsJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "intervalSec" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastEnqueuedAt" TIMESTAMP(3),
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "missions_status_scheduledAt_idx" ON "missions"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "missions_ownerEmployeeId_status_idx" ON "missions"("ownerEmployeeId", "status");

-- CreateIndex
CREATE INDEX "missions_requiredSpecialization_status_idx" ON "missions"("requiredSpecialization", "status");

-- CreateIndex
CREATE INDEX "missions_workspaceId_objectiveHash_status_idx" ON "missions"("workspaceId", "objectiveHash", "status");

-- CreateIndex
CREATE INDEX "missions_parentMissionId_idx" ON "missions"("parentMissionId");

-- CreateIndex
CREATE INDEX "mission_events_missionId_createdAt_idx" ON "mission_events"("missionId", "createdAt");

-- CreateIndex
CREATE INDEX "schedule_rules_enabled_idx" ON "schedule_rules"("enabled");

-- AddForeignKey
ALTER TABLE "mission_events" ADD CONSTRAINT "mission_events_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
