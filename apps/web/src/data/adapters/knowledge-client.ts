import type { HttpClient } from "./http-client";
import { createHttpClient } from "./http-client";

export type KnowledgeItemType = "NOTE" | "DOCUMENT" | "LINK";

export interface KnowledgeItemDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly type: KnowledgeItemType;
  readonly title: string;
  readonly content: string | null;
  readonly fileRef: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateKnowledgeItemBody {
  readonly workspaceId: string;
  readonly type?: KnowledgeItemType;
  readonly title: string;
  readonly content?: string | null;
}

export interface UpdateKnowledgeItemBody {
  readonly title?: string;
  readonly content?: string | null;
}

export interface KnowledgeClient {
  /** Sempre escopado por workspaceId — nunca lista entre projetos (P1.14B/Parte 17). */
  listByWorkspace(workspaceId: string): Promise<readonly KnowledgeItemDto[]>;
  create(body: CreateKnowledgeItemBody): Promise<KnowledgeItemDto>;
  update(id: string, body: UpdateKnowledgeItemBody): Promise<KnowledgeItemDto>;
  remove(id: string): Promise<void>;
}

/** Cliente do CRUD mínimo de Knowledge (P1.14B) — /api/v1/knowledge. */
export function createKnowledgeClient(
  client: HttpClient = createHttpClient(),
): KnowledgeClient {
  return {
    async listByWorkspace(
      workspaceId: string,
    ): Promise<readonly KnowledgeItemDto[]> {
      return client.get<readonly KnowledgeItemDto[]>(
        `/knowledge?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
    },

    async create(body: CreateKnowledgeItemBody): Promise<KnowledgeItemDto> {
      return client.post<KnowledgeItemDto>("/knowledge", body);
    },

    async update(
      id: string,
      body: UpdateKnowledgeItemBody,
    ): Promise<KnowledgeItemDto> {
      return client.patch<KnowledgeItemDto>(`/knowledge/${id}`, body);
    },

    async remove(id: string): Promise<void> {
      await client.delete<void>(`/knowledge/${id}`);
    },
  };
}
