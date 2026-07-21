import type { OrchestrationState } from "../engine/orchestration-state.js";
import type { StateStore } from "../ports/state-store.js";

/** StateStore em memoria. Util para dev, testes e execucao efemera. */
export class InMemoryStateStore implements StateStore {
  private readonly states = new Map<string, OrchestrationState>();

  async save(state: OrchestrationState): Promise<void> {
    this.states.set(state.id, state);
  }

  async load(id: string): Promise<OrchestrationState | null> {
    return this.states.get(id) ?? null;
  }
}
