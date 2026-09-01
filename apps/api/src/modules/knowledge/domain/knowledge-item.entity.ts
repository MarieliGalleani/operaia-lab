import type { Timestamps, UUID } from "@operaia/shared";

export type KnowledgeItemType = "NOTE" | "DOCUMENT" | "LINK";

/**
 * Entidade de dominio KnowledgeItem (P1.14B) — conhecimento minimo
 * pertencente a um projeto via workspaceId (mesmo padrao ja usado por
 * Mission/OfficeDemand/etc). Nesta fase so NOTE tem UI funcional;
 * DOCUMENT/LINK existem no tipo para nao exigir migration nova quando
 * ingestao de arquivo/link for construida — fileRef reservado, sem
 * storage por tras ainda.
 */
export interface KnowledgeItem extends Timestamps {
  readonly id: UUID;
  readonly workspaceId: string;
  readonly type: KnowledgeItemType;
  readonly title: string;
  readonly content: string | null;
  readonly fileRef: string | null;
}
