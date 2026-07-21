/**
 * PresenceProvider generico mock: um unico ator local (o usuario).
 *
 * Reutilizavel por qualquer dominio (ex.: office-domain) para evitar duplicacao.
 */

import type { PresenceActor, PresenceProvider } from "../../contracts/presence";

export class MockPresenceProvider implements PresenceProvider {
  private readonly localActor: PresenceActor = {
    id: "local-user",
    displayName: "Voce",
    kind: "user",
    local: true,
    color: "#6C5CE7",
  };

  getLocalActor(): PresenceActor {
    return this.localActor;
  }

  async listActors(_scopeId: string): Promise<readonly PresenceActor[]> {
    return [this.localActor];
  }
}
