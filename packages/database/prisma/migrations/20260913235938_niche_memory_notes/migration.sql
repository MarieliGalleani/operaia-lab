-- CreateTable
CREATE TABLE "niche_memory_notes" (
    "id" TEXT NOT NULL,
    "nicheId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stage" "MarketingStage" NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "niche_memory_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "niche_memory_notes_nicheId_stage_createdAt_idx" ON "niche_memory_notes"("nicheId", "stage", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "niche_memory_notes_nicheId_campaignId_stage_key" ON "niche_memory_notes"("nicheId", "campaignId", "stage");

-- AddForeignKey
ALTER TABLE "niche_memory_notes" ADD CONSTRAINT "niche_memory_notes_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "niches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
