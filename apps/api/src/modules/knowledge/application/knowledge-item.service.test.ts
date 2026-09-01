import type { UUID } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import type { KnowledgeItem } from "../domain/knowledge-item.entity.js";
import type {
  CreateKnowledgeItemInput,
  KnowledgeItemRepository,
  UpdateKnowledgeItemInput,
} from "../domain/knowledge-item.repository.js";
import { KnowledgeItemService } from "./knowledge-item.service.js";

/** Repositorio fake em memoria — sem banco, mesmo padrao de FakeProjectRepository. */
class FakeKnowledgeItemRepository implements KnowledgeItemRepository {
  private readonly rows = new Map<string, KnowledgeItem>();
  private seq = 0;

  async create(input: CreateKnowledgeItemInput): Promise<KnowledgeItem> {
    this.seq += 1;
    const now = new Date();
    const row: KnowledgeItem = {
      id: `ki-${this.seq}`,
      workspaceId: input.workspaceId,
      type: input.type ?? "NOTE",
      title: input.title,
      content: input.content ?? null,
      fileRef: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: UUID): Promise<KnowledgeItem | null> {
    return this.rows.get(id) ?? null;
  }

  async findByWorkspace(workspaceId: string): Promise<KnowledgeItem[]> {
    return [...this.rows.values()].filter(
      (row) => row.workspaceId === workspaceId,
    );
  }

  async update(id: UUID, input: UpdateKnowledgeItemInput): Promise<KnowledgeItem> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`not found: ${id}`);
    }
    const updated: KnowledgeItem = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: UUID): Promise<void> {
    this.rows.delete(id);
  }
}

describe("KnowledgeItemService (P1.14B)", () => {
  it("cria, lista, edita e remove uma NOTE", async () => {
    const service = new KnowledgeItemService(new FakeKnowledgeItemRepository());

    const created = await service.create({
      workspaceId: "nexo",
      title: "Primeira nota",
      content: "conteudo inicial",
    });
    expect(created.type).toBe("NOTE");
    expect(created.title).toBe("Primeira nota");

    const listed = await service.listByWorkspace("nexo");
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(created.id);

    const updated = await service.update(created.id, {
      title: "Nota editada",
      content: "conteudo editado",
    });
    expect(updated.title).toBe("Nota editada");
    expect(updated.content).toBe("conteudo editado");

    await service.remove(created.id);
    const afterDelete = await service.listByWorkspace("nexo");
    expect(afterDelete).toHaveLength(0);
  });

  it("isola conhecimento por workspaceId — workspace A nunca ve conhecimento de B", async () => {
    const service = new KnowledgeItemService(new FakeKnowledgeItemRepository());

    await service.create({ workspaceId: "workspace-a", title: "Nota A1" });
    await service.create({ workspaceId: "workspace-a", title: "Nota A2" });
    await service.create({ workspaceId: "workspace-b", title: "Nota B1" });

    const a = await service.listByWorkspace("workspace-a");
    const b = await service.listByWorkspace("workspace-b");

    expect(a).toHaveLength(2);
    expect(b).toHaveLength(1);
    expect(a.every((item) => item.workspaceId === "workspace-a")).toBe(true);
    expect(b.every((item) => item.workspaceId === "workspace-b")).toBe(true);
    expect(a.map((item) => item.title)).not.toContain("Nota B1");
  });

  it("rejeita titulo vazio", async () => {
    const service = new KnowledgeItemService(new FakeKnowledgeItemRepository());
    await expect(
      service.create({ workspaceId: "nexo", title: "   " }),
    ).rejects.toThrow(/nao pode ser vazio/);
  });

  it("rejeita conteudo maior que o limite", async () => {
    const service = new KnowledgeItemService(new FakeKnowledgeItemRepository());
    const huge = "x".repeat(20_001);
    await expect(
      service.create({ workspaceId: "nexo", title: "ok", content: huge }),
    ).rejects.toThrow(/excede 20000 caracteres/);
  });

  it("getById lanca NotFoundError para id inexistente", async () => {
    const service = new KnowledgeItemService(new FakeKnowledgeItemRepository());
    await expect(service.getById("nope")).rejects.toThrow();
  });
});
