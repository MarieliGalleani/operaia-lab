/**
 * Persistencia do estado visual do mundo.
 *
 * `LocalStorageStateStore` (browser) e `MemoryStateStore` (SSR/testes).
 * Chaveado por `scopeId` (empresa/projeto).
 */

import type { StateStore, WorldViewState } from "../../contracts/state";

const KEY_PREFIX = "operaia.world.view";

function keyFor(prefix: string, scopeId: string): string {
  return `${prefix}.${scopeId}`;
}

export class MemoryStateStore implements StateStore {
  private readonly map = new Map<string, WorldViewState>();

  save(state: WorldViewState): void {
    this.map.set(state.scopeId, state);
  }

  load(scopeId: string): WorldViewState | undefined {
    return this.map.get(scopeId);
  }

  clear(scopeId: string): void {
    this.map.delete(scopeId);
  }
}

export class LocalStorageStateStore implements StateStore {
  constructor(private readonly prefix: string = KEY_PREFIX) {}

  save(state: WorldViewState): void {
    try {
      window.localStorage.setItem(keyFor(this.prefix, state.scopeId), JSON.stringify(state));
    } catch {
      // storage indisponivel/cheio: estado e best-effort.
    }
  }

  load(scopeId: string): WorldViewState | undefined {
    try {
      const raw = window.localStorage.getItem(keyFor(this.prefix, scopeId));
      return raw ? (JSON.parse(raw) as WorldViewState) : undefined;
    } catch {
      return undefined;
    }
  }

  clear(scopeId: string): void {
    try {
      window.localStorage.removeItem(keyFor(this.prefix, scopeId));
    } catch {
      // ignora
    }
  }
}

export function createStateStore(): StateStore {
  const hasStorage =
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { localStorage?: unknown }).localStorage !== "undefined";
  return hasStorage ? new LocalStorageStateStore() : new MemoryStateStore();
}
