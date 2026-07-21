/** Agrega os providers mock genericos em um WorldDataProvider. */

import type { WorldDataProvider } from "../../contracts/providers";
import { MockAssetProvider } from "./mock-asset-provider";
import { MockEntityProvider } from "./mock-entity-provider";
import { MockMapProvider } from "./mock-map-provider";
import { MockPresenceProvider } from "./mock-presence-provider";

export class MockWorldDataProvider implements WorldDataProvider {
  readonly kind = "mock";
  readonly maps = new MockMapProvider();
  readonly entities = new MockEntityProvider();
  readonly assets = new MockAssetProvider();
  readonly presence = new MockPresenceProvider();
}
