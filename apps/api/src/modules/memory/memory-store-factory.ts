/**
 * Factory MemoryStore — flag MEMORY_STORE (prisma | inmemory).
 * Kill-switch: MEMORY_STORE=inmemory volta ao store volátil.
 */
import type { MemoryStore } from "@operaia/memory";
import { InMemoryMemoryStore } from "@operaia/workspace-runtime";
import { PrismaOperationalMemoryStore } from "./prisma-operational-memory-store.js";

export type MemoryStoreMode = "prisma" | "inmemory";

export function resolveMemoryStoreMode(
  raw: string | undefined,
): MemoryStoreMode {
  return raw === "inmemory" ? "inmemory" : "prisma";
}

export function createMemoryStore(
  mode: MemoryStoreMode = "prisma",
): MemoryStore {
  if (mode === "inmemory") {
    return new InMemoryMemoryStore();
  }
  return new PrismaOperationalMemoryStore();
}
