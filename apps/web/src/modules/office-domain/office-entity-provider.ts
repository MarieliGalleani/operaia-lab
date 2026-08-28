/**
 * EntityProvider do dominio: atores por mapa.
 *
 * Mapas do Campus (infra compartilhada) nao tem funcionarios de Residente.
 * A sede e cada andar de cliente real devolvem sempre o MESMO elenco real
 * (real-agents.ts) — nao ha personagem novo por cliente.
 */

import type { ActorDescriptor, EntityProvider } from "../virtual-world/contracts/providers";
import {
  CAMPUS_PLAZA_MAP_ID,
  CAMPUS_RECEPTION_MAP_ID,
} from "./data/campus-ids";
import { CLIENT_FLOORS } from "./data/client-floors-registry";
import { OFFICE_ACTORS } from "./data/office-actors";
import { OFFICE_MAP_ID } from "./data/office-map";

const CAMPUS_MAP_IDS = new Set([CAMPUS_RECEPTION_MAP_ID, CAMPUS_PLAZA_MAP_ID]);

const CLIENT_FLOOR_ACTORS: ReadonlyMap<string, readonly ActorDescriptor[]> =
  new Map(CLIENT_FLOORS.map((build) => [build.floorMapId, build.actors]));

export class OfficeEntityProvider implements EntityProvider {
  async listActors(mapId: string): Promise<readonly ActorDescriptor[]> {
    if (CAMPUS_MAP_IDS.has(mapId)) {
      return [];
    }
    if (mapId === OFFICE_MAP_ID) {
      return OFFICE_ACTORS;
    }
    return CLIENT_FLOOR_ACTORS.get(mapId) ?? [];
  }
}
