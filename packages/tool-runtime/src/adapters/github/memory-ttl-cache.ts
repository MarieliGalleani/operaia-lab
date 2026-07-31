/**
 * Cache TTL em memoria — sem persistencia (Sprint A.2).
 */
export class MemoryTtlCache {
  private readonly store = new Map<
    string,
    { readonly value: unknown; readonly expiresAt: number }
  >();

  constructor(private readonly defaultTtlMs = 60_000) {}

  get<T>(key: string): T | undefined {
    const row = this.store.get(key);
    if (!row) {
      return undefined;
    }
    if (Date.now() >= row.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return row.value as T;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(0, ttlMs),
    });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
