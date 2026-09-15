-- Generaliza NicheMemoryNote pra qualquer andar (nao so Marketing) e
-- adiciona o pipeline por cliente do Atlas (AutomationEngagement).

-- Cerebro do Nicho generico: campaignId -> sourceId, stage vira texto livre,
-- e ganha um discriminador "office" pra nao misturar etapas de mesmo nome
-- entre andares diferentes (ex: DIAGNOSTICO do Marketing vs da Automacao).
DROP INDEX "niche_memory_notes_nicheId_campaignId_stage_key";
DROP INDEX "niche_memory_notes_nicheId_stage_createdAt_idx";
ALTER TABLE "niche_memory_notes" RENAME COLUMN "campaignId" TO "sourceId";
ALTER TABLE "niche_memory_notes" ALTER COLUMN "stage" TYPE TEXT USING "stage"::TEXT;
ALTER TABLE "niche_memory_notes" ADD COLUMN "office" TEXT NOT NULL DEFAULT 'MARKETING';
ALTER TABLE "niche_memory_notes" ALTER COLUMN "office" DROP DEFAULT;
ALTER TABLE "niche_memory_notes" ADD CONSTRAINT "niche_memory_notes_nicheId_office_sourceId_stage_key" UNIQUE ("nicheId", "office", "sourceId", "stage");
CREATE INDEX "niche_memory_notes_nicheId_office_stage_createdAt_idx" ON "niche_memory_notes"("nicheId", "office", "stage", "createdAt");

-- Pipeline por cliente do Atlas (Automation Specialist), mesma logica do
-- Mercurio (marketing_campaigns): nicho + briefing entram, o Cerebro do
-- Nicho acumula conhecimento real entre clientes do mesmo setor.
CREATE TYPE "AutomationEngagementStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'ERROR');

CREATE TYPE "AutomationStage" AS ENUM ('DIAGNOSTICO', 'MAPA_PROCESSOS', 'AUTOMACOES_RECOMENDADAS', 'ARQUITETURA_INTEGRACAO', 'PLANO_IMPLEMENTACAO', 'PLAYBOOK_OPERACIONAL', 'FRAMEWORK_MONITORAMENTO');

ALTER TYPE "ClientMetricKind" ADD VALUE 'AUTOMACAO';

CREATE TABLE "automation_engagements" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "nicheId" TEXT NOT NULL,
    "clientId" TEXT,
    "briefing" TEXT NOT NULL,
    "status" "AutomationEngagementStatus" NOT NULL DEFAULT 'PENDING',
    "currentStage" "AutomationStage",
    "diagnostico" TEXT,
    "mapaProcessos" TEXT,
    "automacoesRecomendadas" TEXT,
    "arquiteturaIntegracao" TEXT,
    "planoImplementacao" TEXT,
    "playbookOperacional" TEXT,
    "frameworkMonitoramento" TEXT,
    "attachmentName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentBase64" TEXT,
    "errorMessage" TEXT,
    "fallbackStagesJson" JSONB,
    "stageDurationsMsJson" JSONB,
    "nicheMemoryHitsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_engagements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automation_engagements_status_idx" ON "automation_engagements"("status");

CREATE INDEX "automation_engagements_nicheId_idx" ON "automation_engagements"("nicheId");

CREATE INDEX "automation_engagements_clientId_idx" ON "automation_engagements"("clientId");

ALTER TABLE "automation_engagements" ADD CONSTRAINT "automation_engagements_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "niches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "automation_engagements" ADD CONSTRAINT "automation_engagements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
