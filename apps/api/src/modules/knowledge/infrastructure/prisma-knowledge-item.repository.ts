import { prisma, type KnowledgeItem as PrismaKnowledgeItem } from "@operaia/database";
import type { UUID } from "@operaia/shared";
import type { KnowledgeItem } from "../domain/knowledge-item.entity.js";
import type {
  CreateKnowledgeItemInput,
  KnowledgeItemRepository,
  UpdateKnowledgeItemInput,
} from "../domain/knowledge-item.repository.js";

function toDomain(row: PrismaKnowledgeItem): KnowledgeItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    title: row.title,
    content: row.content,
    fileRef: row.fileRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaKnowledgeItemRepository implements KnowledgeItemRepository {
  async create(input: CreateKnowledgeItemInput): Promise<KnowledgeItem> {
    const row = await prisma.knowledgeItem.create({
      data: {
        workspaceId: input.workspaceId,
        type: input.type ?? "NOTE",
        title: input.title,
        content: input.content ?? null,
      },
    });
    return toDomain(row);
  }

  async findById(id: UUID): Promise<KnowledgeItem | null> {
    const row = await prisma.knowledgeItem.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<KnowledgeItem[]> {
    const rows = await prisma.knowledgeItem.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async update(id: UUID, input: UpdateKnowledgeItemInput): Promise<KnowledgeItem> {
    const row = await prisma.knowledgeItem.update({
      where: { id },
      data: input,
    });
    return toDomain(row);
  }

  async delete(id: UUID): Promise<void> {
    await prisma.knowledgeItem.delete({ where: { id } });
  }
}
