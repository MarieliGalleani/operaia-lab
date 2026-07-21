/** MapProvider generico mock: serve o mapa de exemplo por id. */

import type { MapManifest, MapSummary } from "../../contracts/map";
import type { MapProvider } from "../../contracts/providers";
import { SAMPLE_MAP } from "./data/sample-map";

const CATALOG: Readonly<Record<string, MapManifest>> = {
  [SAMPLE_MAP.id]: SAMPLE_MAP,
};

export class MockMapProvider implements MapProvider {
  async getMap(mapId: string): Promise<MapManifest> {
    const manifest = CATALOG[mapId];
    if (!manifest) {
      throw new Error(`Mapa desconhecido no provider generico: ${mapId}`);
    }
    return manifest;
  }

  async listMaps(_scopeId: string): Promise<readonly MapSummary[]> {
    return Object.values(CATALOG).map((m) => ({ id: m.id, name: m.name, themeId: m.themeId }));
  }
}
