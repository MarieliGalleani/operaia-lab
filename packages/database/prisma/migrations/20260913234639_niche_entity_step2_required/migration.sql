/*
  Warnings:

  - Made the column `nicheId` on table `marketing_campaigns` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "marketing_campaigns" DROP CONSTRAINT "marketing_campaigns_nicheId_fkey";

-- AlterTable
ALTER TABLE "marketing_campaigns" ALTER COLUMN "nicheId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "niches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
