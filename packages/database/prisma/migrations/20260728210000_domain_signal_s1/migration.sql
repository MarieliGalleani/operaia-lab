-- Domain Signal Layer S1 (ADR-009)
-- deliveryId = idempotencia; signalHash = similaridade (nao unique)

CREATE TYPE "DomainSignalStatus" AS ENUM (
  'DETECTED',
  'EVALUATED',
  'CONVERTED',
  'RESOLVED',
  'IGNORED',
  'EXPIRED'
);

CREATE TYPE "DomainSignalEvaluationDecision" AS ENUM (
  'CONVERT_CANDIDATE',
  'IGNORE',
  'DEFER'
);

CREATE TABLE "workspace_source_bindings" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "externalRef" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "configJson" JSONB,
  "secretRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workspace_source_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_source_bindings_workspaceId_sourceType_externalRef_key"
  ON "workspace_source_bindings"("workspaceId", "sourceType", "externalRef");

CREATE INDEX "workspace_source_bindings_sourceType_externalRef_enabled_idx"
  ON "workspace_source_bindings"("sourceType", "externalRef", "enabled");

CREATE TABLE "domain_signals" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "bindingId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "type" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "signalHash" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "status" "DomainSignalStatus" NOT NULL DEFAULT 'DETECTED',
  "payloadJson" JSONB NOT NULL,
  "metadataJson" JSONB,
  "evaluationDecision" "DomainSignalEvaluationDecision",
  "evaluationPolicy" TEXT,
  "evaluationReason" TEXT,
  "evaluationJson" JSONB,
  "evaluatedAt" TIMESTAMP(3),
  "missionId" TEXT,
  "payloadVersion" INTEGER NOT NULL DEFAULT 1,
  "occurredAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "convertedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "domain_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domain_signals_sourceType_deliveryId_key"
  ON "domain_signals"("sourceType", "deliveryId");

CREATE INDEX "domain_signals_workspaceId_status_receivedAt_idx"
  ON "domain_signals"("workspaceId", "status", "receivedAt");

CREATE INDEX "domain_signals_workspaceId_signalHash_receivedAt_idx"
  ON "domain_signals"("workspaceId", "signalHash", "receivedAt");

CREATE INDEX "domain_signals_correlationId_idx"
  ON "domain_signals"("correlationId");

CREATE INDEX "domain_signals_missionId_idx"
  ON "domain_signals"("missionId");

CREATE INDEX "domain_signals_type_receivedAt_idx"
  ON "domain_signals"("type", "receivedAt");

CREATE INDEX "domain_signals_evaluationDecision_status_idx"
  ON "domain_signals"("evaluationDecision", "status");

ALTER TABLE "domain_signals"
  ADD CONSTRAINT "domain_signals_bindingId_fkey"
  FOREIGN KEY ("bindingId") REFERENCES "workspace_source_bindings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
