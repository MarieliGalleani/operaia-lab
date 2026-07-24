/**
 * EntityProvider do dominio: atores por mapa.
 *
 * Mapas do Campus (infra compartilhada) nao tem funcionarios de Residente.
 * Cada Residente fornece atores apenas nos proprios mapas.
 */

import type { ActorDescriptor, EntityProvider } from "../virtual-world/contracts/providers";
import {
  CAMPUS_PLAZA_MAP_ID,
  CAMPUS_RECEPTION_MAP_ID,
  GERAI_ENTRANCE_MAP_ID,
} from "./data/campus-ids";
import { GERAI_F2_ACTORS } from "./data/gerai-actors";
import { GERAI_F2_MAP_ID } from "./data/gerai-floor-2-map";
import { OFFICE_ACTORS } from "./data/office-actors";
import { OFFICE_MAP_ID } from "./data/office-map";

const CAMPUS_MAP_IDS = new Set([
  CAMPUS_RECEPTION_MAP_ID,
  CAMPUS_PLAZA_MAP_ID,
  GERAI_ENTRANCE_MAP_ID,
]);

export class OfficeEntityProvider implements EntityProvider {
  async listActors(mapId: string): Promise<readonly ActorDescriptor[]> {
    if (CAMPUS_MAP_IDS.has(mapId)) {
      return [];
    }
    if (mapId === GERAI_F2_MAP_ID) {
      return GERAI_F2_ACTORS;
    }
    if (mapId === OFFICE_MAP_ID) {
      return OFFICE_ACTORS;
    }
    return [];
  }
}
