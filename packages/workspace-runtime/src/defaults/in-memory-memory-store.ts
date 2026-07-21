import type {
  MemoryRecord,
  MemorySearchResult,
  MemoryStore,
} from "@operaia/memory";

/**
 * Placeholder de memoria em processo. Armazena registros mas nao faz busca
 * semantica (sem embeddings). Substituido por uma implementacao real
 * (ex.: PostgreSQL + pgvector) via injecao de dependencias.
 */
export class InMemoryMemoryStore implements MemoryStore {
  private readonly records: MemoryRecord[] = [];

  async store(record: MemoryRecord): Promise<void> {
    this.records.push(record);
  }

  async search(): Promise<readonly MemorySearchResult[]> {
    return [];
  }
}
