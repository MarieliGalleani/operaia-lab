-- CreateEnum
CREATE TYPE "ClientMetricKind" AS ENUM ('TRAFEGO', 'PERFORMANCE');

-- CreateTable
CREATE TABLE "client_metric_entries" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" "ClientMetricKind" NOT NULL,
    "metric" TEXT NOT NULL,
    "channel" TEXT,
    "period" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_metric_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_metric_entries_clientId_kind_period_idx" ON "client_metric_entries"("clientId", "kind", "period");

-- AddForeignKey
ALTER TABLE "client_metric_entries" ADD CONSTRAINT "client_metric_entries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
