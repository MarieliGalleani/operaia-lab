/** EntityProvider generico mock: sem atores no mapa de exemplo. */

import type { ActorDescriptor, EntityProvider } from "../../contracts/providers";

export class MockEntityProvider implements EntityProvider {
  async listActors(_mapId: string): Promise<readonly ActorDescriptor[]> {
    return [];
  }
}
