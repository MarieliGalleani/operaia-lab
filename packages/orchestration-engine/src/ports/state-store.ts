import type { OrchestrationState } from "../engine/orchestration-state.js";

/** Persistencia do estado de orquestracao. Implementacao concreta fica fora. */
export interface StateStore {
  save(state: OrchestrationState): Promise<void>;
  load(id: string): Promise<OrchestrationState | null>;
}
