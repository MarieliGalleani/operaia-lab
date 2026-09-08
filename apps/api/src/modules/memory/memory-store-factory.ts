/**
 * Factory MemoryStore — flag MEMORY_STORE (prisma | inmemory).
 * Kill-switch: MEMORY_STORE=inmemory volta ao store volátil.
 */
import { GeminiEmbeddingsProvider } from "@operaia/ai-core";
import type { MemoryStore } from "@operaia/memory";
import { InMemoryMemoryStore } from "@operaia/workspace-runtime";
import { PrismaOperationalMemoryStore } from "./prisma-operational-memory-store.js";

export type MemoryStoreMode = "prisma" | "inmemory";

export function resolveMemoryStoreMode(
  raw: string | undefined,
): MemoryStoreMode {
  return raw === "inmemory" ? "inmemory" : "prisma";
}

export interface CreateMemoryStoreOptions {
  /**
   * Mesma chave do GeminiProvider (LLM_PROVIDER=gemini) — sem ela, busca
   * de memoria fica so lexical (P1.25).
   */
  readonly embeddingsApiKey?: string | null;
}

export function createMemoryStore(
  mode: MemoryStoreMode = "prisma",
  options: CreateMemoryStoreOptions = {},
): MemoryStore {
  if (mode === "inmemory") {
    return new InMemoryMemoryStore();
  }
  const embeddings = options.embeddingsApiKey
    ? new GeminiEmbeddingsProvider({ apiKey: options.embeddingsApiKey })
    : undefined;
  return new PrismaOperationalMemoryStore({ embeddings });
}
