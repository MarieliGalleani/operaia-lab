/**
 * MapProvider do dominio espacial: Campus + sede + andares de clientes reais.
 *
 * Novos Residentes = registrar manifests no catalogo (sem logica na engine).
 */

import type { MapManifest, MapSummary } from "../virtual-world/contracts/map";
import type { MapProvider } from "../virtual-world/contracts/providers";
import { CAMPUS_PLAZA_MAP } from "./data/campus-plaza-map";
import { CAMPUS_RECEPTION_MAP } from "./data/campus-reception-map";
import { CLIENT_FLOORS } from "./data/client-floors-registry";
import { OFFICE_MAP } from "./data/office-map";

const CLIENT_MAP_ENTRIES: Readonly<Record<string, MapManifest>> =
  Object.fromEntries(
    CLIENT_FLOORS.flatMap((build) => [
      [build.entranceMapId, build.entranceMap],
      [build.floorMapId, build.floorMap],
    ]),
  );

const WORLD_CATALOG: Readonly<Record<string, MapManifest>> = {
  [CAMPUS_RECEPTION_MAP.id]: CAMPUS_RECEPTION_MAP,
  [CAMPUS_PLAZA_MAP.id]: CAMPUS_PLAZA_MAP,
  [OFFICE_MAP.id]: OFFICE_MAP,
  ...CLIENT_MAP_ENTRIES,
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
