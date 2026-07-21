/**
 * Compoe os providers do dominio "escritorio" em um WorldDataProvider.
 *
 * A presenca reaproveita o provider generico do virtual-world (sem duplicacao).
 * Esta e a peca que a casca Vue injeta em <VirtualWorld :provider="..."> para
 * carregar o escritorio como PRIMEIRO mapa do Mundo Virtual.
 */

import type { WorldDataProvider } from "../virtual-world/contracts/providers";
import { MockPresenceProvider } from "../virtual-world/providers/mock/mock-presence-provider";
import { OfficeAssetProvider } from "./office-asset-provider";
import { OfficeEntityProvider } from "./office-entity-provider";
import { OfficeMapProvider } from "./office-map-provider";

export class OfficeWorldDataProvider implements WorldDataProvider {
  readonly kind = "office-mock";
  readonly maps = new OfficeMapProvider();
  readonly entities = new OfficeEntityProvider();
  readonly assets = new OfficeAssetProvider();
  readonly presence = new MockPresenceProvider();
}

/** Factory conveniente para injecao no wrapper Vue. */
export function createOfficeWorldProvider(): WorldDataProvider {
  return new OfficeWorldDataProvider();
}
