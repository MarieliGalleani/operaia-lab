-- AlterTable
ALTER TABLE "marketing_campaigns" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nicheId" TEXT NOT NULL,
    "setupPaid" BOOLEAN NOT NULL DEFAULT false,
    "recurringActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_nicheId_idx" ON "clients"("nicheId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_nicheId_slug_key" ON "clients"("nicheId", "slug");

-- CreateIndex
CREATE INDEX "marketing_campaigns_clientId_idx" ON "marketing_campaigns"("clientId");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "niches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
