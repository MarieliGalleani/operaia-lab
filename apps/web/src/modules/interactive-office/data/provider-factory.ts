import { ApiProvider } from "./api-provider";
import { MockProvider } from "./mock-provider";
import type { InteractiveOfficeProvider } from "./office-provider";

/**
 * Escolhe o provider conforme o ambiente.
 * Caminho principal = API real. Mock só com VITE_USE_REAL_API=false.
 */
export function createOfficeProvider(): InteractiveOfficeProvider {
  const useMock = import.meta.env.VITE_USE_REAL_API === "false";
  return useMock ? new MockProvider() : new ApiProvider();
}
