/**
 * MapProvider do dominio espacial: Campus + mapas dos Residentes.
 *
 * Novos Residentes = registrar manifests no catalogo (sem logica na engine).
 */

import type { MapManifest, MapSummary } from "../virtual-world/contracts/map";
import type { MapProvider } from "../virtual-world/contracts/providers";
import { CAMPUS_PLAZA_MAP } from "./data/campus-plaza-map";
import { CAMPUS_RECEPTION_MAP } from "./data/campus-reception-map";
import { GERAI_ENTRANCE_MAP } from "./data/gerai-entrance-map";
import { GERAI_F2_MAP } from "./data/gerai-floor-2-map";
import { OFFICE_MAP } from "./data/office-map";

const WORLD_CATALOG: Readonly<Record<string, MapManifest>> = {
  [CAMPUS_RECEPTION_MAP.id]: CAMPUS_RECEPTION_MAP,
  [CAMPUS_PLAZA_MAP.id]: CAMPUS_PLAZA_MAP,
  [OFFICE_MAP.id]: OFFICE_MAP,
  [GERAI_ENTRANCE_MAP.id]: GERAI_ENTRANCE_MAP,
  [GERAI_F2_MAP.id]: GERAI_F2_MAP,
};

export class OfficeMapProvider implements MapProvider {
  async getMap(mapId: string): Promise<MapManifest> {
    const manifest = WORLD_CATALOG[mapId];
    if (!manifest) {
      throw new Error(`Mapa desconhecido no dominio espacial: ${mapId}`);
    }
    return manifest;
  }

  async listMaps(_scopeId: string): Promise<readonly MapSummary[]> {
    return Object.values(WORLD_CATALOG).map((m) => ({
      id: m.id,
      name: m.name,
      themeId: m.themeId,
    }));
  }
}
