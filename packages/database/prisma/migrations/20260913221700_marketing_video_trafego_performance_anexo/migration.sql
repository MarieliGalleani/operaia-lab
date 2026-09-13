-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketingStage" ADD VALUE 'VIDEO_ROTEIRO';
ALTER TYPE "MarketingStage" ADD VALUE 'PLANO_TRAFEGO';
ALTER TYPE "MarketingStage" ADD VALUE 'FRAMEWORK_PERFORMANCE';

-- AlterTable
ALTER TABLE "marketing_campaigns" ADD COLUMN     "attachmentBase64" TEXT,
ADD COLUMN     "attachmentMimeType" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "frameworkPerformance" TEXT,
ADD COLUMN     "planoTrafego" TEXT,
ADD COLUMN     "videoRoteiro" TEXT;
