-- Action Runtime A.4: auditoria de acoes controladas (sem shell arbitrario).

CREATE TYPE "ActionExecutionStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'DENIED'
);

CREATE TABLE "action_executions" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "status" "ActionExecutionStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "action_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "action_executions_workspaceId_requestedAt_idx"
  ON "action_executions"("workspaceId", "requestedAt");

CREATE INDEX "action_executions_employeeId_requestedAt_idx"
  ON "action_executions"("employeeId", "requestedAt");

CREATE INDEX "action_executions_actionId_status_idx"
  ON "action_executions"("actionId", "status");
