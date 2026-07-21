import { createHttpGateways } from "./adapters/http-gateways";
import { createMockGateways } from "./adapters/mock-gateways";
import { CompositeOfficeService } from "./composite-office-service";
import type { OfficeService } from "./office-service";

/** Origem dos dados do escritório. */
export type OfficeDataMode = "mock" | "http";

/**
 * Composition root do Virtual Office: escolhe os adapters e monta a fachada.
 * É o ÚNICO lugar que decide entre mock e API real.
 */
export function createOfficeService(mode: OfficeDataMode): OfficeService {
  const gateways = mode === "http" ? createHttpGateways() : createMockGateways();
  return new CompositeOfficeService(gateways);
}

function resolveMode(): OfficeDataMode {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_USE_REAL_API === "true" ? "http" : "mock";
}

/** Instância usada pela aplicação. Ligar a API real = `VITE_USE_REAL_API=true`. */
export const officeService: OfficeService = createOfficeService(resolveMode());
