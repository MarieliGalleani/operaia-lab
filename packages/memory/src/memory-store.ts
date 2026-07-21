import type { UUID } from "@operaia/shared";

/**
 * Contrato de memoria de longo prazo (RAG).
 *
 * Preparado para busca semantica por embeddings. A implementacao concreta
 * (ex.: PostgreSQL + pgvector) sera adicionada numa migration futura, sem
 * alterar este contrato nem os consumidores.
 */

export interface MemoryRecord {
  readonly id: UUID;
  readonly content: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly embedding?: readonly number[];
}

export interface MemoryQuery {
  readonly text: string;
  readonly topK?: number;
  readonly filter?: Readonly<Record<string, unknown>>;
}

export interface MemorySearchResult {
  readonly record: MemoryRecord;
  readonly score: number;
}

export interface MemoryStore {
  store(record: MemoryRecord): Promise<void>;
  search(query: MemoryQuery): Promise<readonly MemorySearchResult[]>;
}
