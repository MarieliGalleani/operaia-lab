-- CreateEnum
CREATE TYPE "MissionKind" AS ENUM ('COORDINATE', 'EXECUTE', 'CONSOLIDATE');

-- AlterTable
ALTER TABLE "missions" ADD COLUMN "missionKind" "MissionKind" NOT NULL DEFAULT 'COORDINATE';

-- CreateIndex
CREATE INDEX "missions_missionKind_status_idx" ON "missions"("missionKind", "status");
