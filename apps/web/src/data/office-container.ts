import { createHttpGateways } from "./adapters/http-gateways";
import { createMockGateways } from "./adapters/mock-gateways";
import { CompositeOfficeService } from "./composite-office-service";
import type { OfficeService } from "./office-service";

/** Origem dos dados do escritório. */
export type OfficeDataMode = "mock" | "http";

/**
 * Composition root do Virtual Office: escolhe os adapters e monta a fachada.
 * É o ÚNICO lugar que decide entre mock e API real.
 *
 * Caminho principal = HTTP (Equipe Digital na API).
 * Mock apenas com `VITE_USE_REAL_API=false` (testes / isolamento).
 */
export function createOfficeService(mode: OfficeDataMode): OfficeService {
  const gateways = mode === "http" ? createHttpGateways() : createMockGateways();
  return new CompositeOfficeService(gateways);
}

function resolveMode(): OfficeDataMode {
  const env = import.meta.env as Record<string, string | undefined>;
  // Opt-out explícito: só mock quando VITE_USE_REAL_API=false
  return env.VITE_USE_REAL_API === "false" ? "mock" : "http";
}

/** Instância usada pela aplicação. Mock = `VITE_USE_REAL_API=false`. */
export const officeService: OfficeService = createOfficeService(resolveMode());
