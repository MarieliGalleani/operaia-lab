/**
 * MapProvider do dominio: serve os mapas do escritorio por id.
 *
 * Implementa a porta generica `MapProvider`. Adicionar novos ambientes
 * (andares, filiais, salas de projeto) = incluir manifestos no catalogo.
 */

import type { MapManifest, MapSummary } from "../virtual-world/contracts/map";
import type { MapProvider } from "../virtual-world/contracts/providers";
import { OFFICE_MAP } from "./data/office-map";

const OFFICE_CATALOG: Readonly<Record<string, MapManifest>> = {
  [OFFICE_MAP.id]: OFFICE_MAP,
};

export class OfficeMapProvider implements MapProvider {
  async getMap(mapId: string): Promise<MapManifest> {
    const manifest = OFFICE_CATALOG[mapId];
    if (!manifest) {
      throw new Error(`Mapa desconhecido no dominio do escritorio: ${mapId}`);
    }
    return manifest;
  }

  async listMaps(_scopeId: string): Promise<readonly MapSummary[]> {
    return Object.values(OFFICE_CATALOG).map((m) => ({
      id: m.id,
      name: m.name,
      themeId: m.themeId,
    }));
  }
}
