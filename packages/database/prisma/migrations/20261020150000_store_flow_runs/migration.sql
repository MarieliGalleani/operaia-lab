-- CreateTable (aditiva: nao altera nem apaga nada existente)
CREATE TABLE "store_flow_runs" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "channelsJson" JSONB NOT NULL,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "runJson" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_flow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_flow_runs_createdAt_idx" ON "store_flow_runs"("createdAt");
