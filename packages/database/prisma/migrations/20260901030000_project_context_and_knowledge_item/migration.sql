-- Project.objective/context/constraints (P1.14B) — aditivo, nullable, sem
-- backfill de projetos existentes. KnowledgeItem (P1.14B) — tabela nova,
-- isolada por workspaceId, nenhuma relacao com tabelas existentes.

ALTER TABLE "projects" ADD COLUMN "objective" TEXT;
ALTER TABLE "projects" ADD COLUMN "context" TEXT;
ALTER TABLE "projects" ADD COLUMN "constraints" TEXT;

CREATE TYPE "KnowledgeItemType" AS ENUM ('NOTE', 'DOCUMENT', 'LINK');

CREATE TABLE "knowledge_items" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "KnowledgeItemType" NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "fileRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "knowledge_items_workspaceId_idx" ON "knowledge_items"("workspaceId");
