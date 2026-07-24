import type {
  MemoryQuery,
  MemoryRecord,
  MemorySearchResult,
  MemoryStore,
} from "@operaia/memory";

/**
 * Memoria em processo. Busca lexical simples (sem embeddings).
 * Substituivel por PostgreSQL + pgvector via injecao de MemoryStore.
 */
export class InMemoryMemoryStore implements MemoryStore {
  private readonly records: MemoryRecord[] = [];

  async store(record: MemoryRecord): Promise<void> {
    this.records.push(record);
  }

  async search(query: MemoryQuery): Promise<readonly MemorySearchResult[]> {
    const topK = query.topK ?? 5;
    const terms = tokenize(query.text);
    const scored: MemorySearchResult[] = [];

    for (const record of this.records) {
      if (!matchesFilter(record.metadata, query.filter)) {
        continue;
      }
      const score = scoreRecord(record.content, query.text, terms);
      if (score <= 0) {
        continue;
      }
      scored.push({ record, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

function matchesFilter(
  metadata: Readonly<Record<string, unknown>> | undefined,
  filter: Readonly<Record<string, unknown>> | undefined,
): boolean {
  if (!filter) {
    return true;
  }
  const meta = metadata ?? {};
  return Object.entries(filter).every(([key, value]) => meta[key] === value);
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3);
}

function scoreRecord(
  content: string,
  rawQuery: string,
  terms: readonly string[],
): number {
  const haystack = content.toLowerCase();
  const needle = rawQuery.trim().toLowerCase();

  if (needle.length > 0 && haystack.includes(needle)) {
    return 1;
  }

  if (terms.length === 0) {
    return 0;
  }

  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      hits += 1;
    }
  }
  return hits / terms.length;
}
