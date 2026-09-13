-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "MarketingStage" AS ENUM ('MAPA_NICHO', 'CRIATIVOS', 'LANDING_PAGE', 'PITCH_DECK', 'PLANO_GTM', 'PLAYBOOK_VENDAS');

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "briefing" TEXT NOT NULL,
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'PENDING',
    "currentStage" "MarketingStage",
    "nicheMap" TEXT,
    "creatives" TEXT,
    "landingPageHtml" TEXT,
    "pitchDeck" TEXT,
    "gtmPlan" TEXT,
    "salesPlaybook" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing_campaigns"("status");
