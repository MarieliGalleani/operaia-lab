-- AlterEnum
ALTER TYPE "MarketingStage" ADD VALUE 'DIAGNOSTICO';

-- AlterTable
ALTER TABLE "marketing_campaigns" ADD COLUMN     "diagnostico" TEXT;
