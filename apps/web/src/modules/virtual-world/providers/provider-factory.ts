/**
 * Fabrica de WorldDataProvider (ports/adapters).
 *
 * Trocar mock -> NEXO -> HTTP e apenas trocar o provider aqui, sem tocar em
 * engine, runtime ou casca Vue. O dominio pode injetar o SEU proprio provider.
 */

import type { WorldDataProvider } from "../contracts/providers";
import { MockWorldDataProvider } from "./mock/mock-world-data-provider";

export type WorldProviderKind = "mock" | "nexo" | "http";

export function createWorldDataProvider(kind: WorldProviderKind = "mock"): WorldDataProvider {
  switch (kind) {
    case "mock":
      return new MockWorldDataProvider();
    case "nexo":
    case "http":
      throw new Error(`Provider '${kind}' sera implementado em fase futura. Use 'mock' na Fase 0.`);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Provider desconhecido: ${String(exhaustive)}`);
    }
  }
}
