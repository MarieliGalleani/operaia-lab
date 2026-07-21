import { ApiProvider } from "./api-provider";
import { MockProvider } from "./mock-provider";
import type { InteractiveOfficeProvider } from "./office-provider";

/**
 * Escolhe o provider conforme o ambiente. Trocar mock por API real é só
 * definir VITE_USE_REAL_API=true — nenhum componente precisa mudar.
 */
export function createOfficeProvider(): InteractiveOfficeProvider {
  const useApi = import.meta.env.VITE_USE_REAL_API === "true";
  return useApi ? new ApiProvider() : new MockProvider();
}
