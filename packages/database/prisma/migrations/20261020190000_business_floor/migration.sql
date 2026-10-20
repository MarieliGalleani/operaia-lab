-- Andar 05 · Negócio (aditiva: nao altera nem apaga nada existente)
CREATE TABLE "business_imports" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowsReceived" INTEGER NOT NULL DEFAULT 0,
    "rowsAccepted" INTEGER NOT NULL DEFAULT 0,
    "rowsDuplicated" INTEGER NOT NULL DEFAULT 0,
    "rowsRejected" INTEGER NOT NULL DEFAULT 0,
    "rejectedJson" JSONB NOT NULL,
    "hasCost" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_sales" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "customer" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "revenueBrl" DOUBLE PRECISION NOT NULL,
    "costBrl" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_sales_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_imports_createdAt_idx" ON "business_imports"("createdAt");
CREATE UNIQUE INDEX "business_sales_dedupKey_key" ON "business_sales"("dedupKey");
CREATE INDEX "business_sales_occurredOn_idx" ON "business_sales"("occurredOn");
CREATE INDEX "business_sales_importId_idx" ON "business_sales"("importId");

ALTER TABLE "business_sales" ADD CONSTRAINT "business_sales_importId_fkey" FOREIGN KEY ("importId") REFERENCES "business_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
