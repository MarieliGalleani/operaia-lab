import type { UUID } from "@operaia/shared";
import type { KnowledgeItem, KnowledgeItemType } from "./knowledge-item.entity.js";

export interface CreateKnowledgeItemInput {
  workspaceId: string;
  type?: KnowledgeItemType;
  title: string;
  content?: string | null;
}

export interface UpdateKnowledgeItemInput {
  title?: string;
  content?: string | null;
}

/**
 * Contrato de persistencia de KnowledgeItem.
 * Definido no dominio; implementado na infraestrutura (inversao de dependencia).
 */
export interface KnowledgeItemRepository {
  create(input: CreateKnowledgeItemInput): Promise<KnowledgeItem>;
  findById(id: UUID): Promise<KnowledgeItem | null>;
  /** Isolamento por projeto — nunca retorna itens de outro workspaceId. */
  findByWorkspace(workspaceId: string): Promise<KnowledgeItem[]>;
  update(id: UUID, input: UpdateKnowledgeItemInput): Promise<KnowledgeItem>;
  delete(id: UUID): Promise<void>;
}
