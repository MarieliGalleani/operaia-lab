/**
 * Compoe os providers do dominio espacial (Opera Campus + Residentes).
 *
 * A casca Vue injeta este provider em <VirtualWorld> para carregar o mundo.
 * O mapa inicial e responsabilidade da pagina (ponto de entrada do produto),
 * nao da engine.
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
