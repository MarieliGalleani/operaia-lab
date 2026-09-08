-- AlterTable
ALTER TABLE "operational_memory_notes" ADD COLUMN     "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[];
