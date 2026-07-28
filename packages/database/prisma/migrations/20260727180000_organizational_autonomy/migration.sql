-- Organizational goals
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "MissionReadiness" AS ENUM ('BLOCKED', 'READY');

CREATE TABLE "organizational_goals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizational_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organizational_goals_status_priority_idx" ON "organizational_goals"("status", "priority");

ALTER TABLE "projects" ADD COLUMN "goalId" TEXT;
CREATE INDEX "projects_goalId_idx" ON "projects"("goalId");
ALTER TABLE "projects" ADD CONSTRAINT "projects_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "organizational_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "missions" ADD COLUMN "readiness" "MissionReadiness" NOT NULL DEFAULT 'READY';
CREATE INDEX "missions_readiness_status_idx" ON "missions"("readiness", "status");

CREATE TABLE "mission_dependencies" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "dependsOnMissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mission_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mission_dependencies_missionId_dependsOnMissionId_key" ON "mission_dependencies"("missionId", "dependsOnMissionId");
CREATE INDEX "mission_dependencies_dependsOnMissionId_idx" ON "mission_dependencies"("dependsOnMissionId");
ALTER TABLE "mission_dependencies" ADD CONSTRAINT "mission_dependencies_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mission_dependencies" ADD CONSTRAINT "mission_dependencies_dependsOnMissionId_fkey" FOREIGN KEY ("dependsOnMissionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mission_learnings" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "context" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "impact" TEXT,
    "risksFound" JSONB,
    "lessonsLearned" TEXT NOT NULL,
    "reuseWhen" TEXT,
    "avoidWhen" TEXT,
    "durationMs" INTEGER,
    "metricsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mission_learnings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mission_learnings_missionId_key" ON "mission_learnings"("missionId");
CREATE INDEX "mission_learnings_workspaceId_createdAt_idx" ON "mission_learnings"("workspaceId", "createdAt");
CREATE INDEX "mission_learnings_projectId_idx" ON "mission_learnings"("projectId");
ALTER TABLE "mission_learnings" ADD CONSTRAINT "mission_learnings_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
