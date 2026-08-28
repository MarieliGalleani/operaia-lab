/**
 * EntityProvider do dominio: atores por mapa.
 *
 * Mapas do Campus (infra compartilhada) nao tem funcionarios de Residente.
 * A sede e cada andar de cliente real devolvem sempre o MESMO elenco real
 * (real-agents.ts) — nao ha personagem novo por cliente — com o status ao
 * vivo (busy/available) buscado do Command Center a cada carregamento do
 * andar (ver live-agent-status.ts para o porque de nao ser push continuo).
 */

import type { ActorDescriptor, EntityProvider } from "../virtual-world/contracts/providers";
import {
  CAMPUS_PLAZA_MAP_ID,
  CAMPUS_RECEPTION_MAP_ID,
} from "./data/campus-ids";
import { CLIENT_FLOORS } from "./data/client-floors-registry";
import { buildOfficeActors } from "./data/office-actors";
import { OFFICE_MAP_ID } from "./data/office-map";
import { buildActorsForStations } from "./data/real-agents";
import { fetchLiveAgentStatus } from "./live-agent-status";

const CAMPUS_MAP_IDS = new Set([CAMPUS_RECEPTION_MAP_ID, CAMPUS_PLAZA_MAP_ID]);

const CLIENT_FLOOR_STATIONS = new Map(
  CLIENT_FLOORS.map((build) => [build.floorMapId, build.stations]),
);

export class OfficeEntityProvider implements EntityProvider {
  async listActors(mapId: string): Promise<readonly ActorDescriptor[]> {
    if (CAMPUS_MAP_IDS.has(mapId)) {
      return [];
    }

    const stations =
      mapId === OFFICE_MAP_ID ? undefined : CLIENT_FLOOR_STATIONS.get(mapId);
    if (mapId !== OFFICE_MAP_ID && !stations) {
      return [];
    }

    const liveStatus = await fetchLiveAgentStatus();
    return mapId === OFFICE_MAP_ID
      ? buildOfficeActors(liveStatus)
      : buildActorsForStations(stations!, liveStatus);
  }
}
