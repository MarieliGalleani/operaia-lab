import { NotFoundError, ValidationError, type UUID } from "@operaia/shared";
import type { KnowledgeItem } from "../domain/knowledge-item.entity.js";
import type {
  CreateKnowledgeItemInput,
  KnowledgeItemRepository,
  UpdateKnowledgeItemInput,
} from "../domain/knowledge-item.repository.js";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20_000;

function assertValidTitle(title: string): void {
  if (!title.trim()) {
    throw new ValidationError("Titulo do conhecimento nao pode ser vazio.");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(
      `Titulo do conhecimento excede ${MAX_TITLE_LENGTH} caracteres.`,
    );
  }
}

function assertValidContent(content: string | null | undefined): void {
  if (typeof content === "string" && content.length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(
      `Conteudo do conhecimento excede ${MAX_CONTENT_LENGTH} caracteres.`,
    );
  }
}

/** Casos de uso do modulo de conhecimento (P1.14B — so NOTE tem UI ainda). */
export class KnowledgeItemService {
  constructor(private readonly repository: KnowledgeItemRepository) {}

  async create(input: CreateKnowledgeItemInput): Promise<KnowledgeItem> {
    assertValidTitle(input.title);
    assertValidContent(input.content);
    return this.repository.create(input);
  }

  /** Sempre escopado por workspaceId — nunca retorna conhecimento de outro projeto. */
  listByWorkspace(workspaceId: string): Promise<KnowledgeItem[]> {
    return this.repository.findByWorkspace(workspaceId);
  }

  async getById(id: UUID): Promise<KnowledgeItem> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new NotFoundError("KnowledgeItem", id);
    }
    return item;
  }

  async update(id: UUID, input: UpdateKnowledgeItemInput): Promise<KnowledgeItem> {
    await this.getById(id);
    if (input.title !== undefined) {
      assertValidTitle(input.title);
    }
    if (input.content !== undefined) {
      assertValidContent(input.content);
    }
    return this.repository.update(id, input);
  }

  async remove(id: UUID): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
