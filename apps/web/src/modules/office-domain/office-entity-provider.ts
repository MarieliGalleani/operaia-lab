/**
 * EntityProvider do dominio: atores por mapa.
 *
 * Mapas do Campus (infra compartilhada) nao tem funcionarios de Residente.
 * A sede mostra sempre o elenco real inteiro (faz sentido — e onde o time
 * inteiro "mora"). Cada andar de cliente real, em vez disso, so mostra
 * quem esta de fato alocado no projeto daquele workspace (Project.teamIds)
 * — antes era sempre o elenco inteiro em todo andar, indistinguivel de
 * cliente pra cliente. Falha ao buscar o projeto = trata como nao
 * confirmado (andar fica vazio) em vez de arriscar mostrar gente errada.
 */

import { officeService } from "@/data/office-container";
import type { ActorDescriptor, EntityProvider } from "../virtual-world/contracts/providers";
import {
  CAMPUS_PLAZA_MAP_ID,
  CAMPUS_RECEPTION_MAP_ID,
} from "./data/campus-ids";
import { CLIENT_FLOORS } from "./data/client-floors-registry";
import { GERAI_F2_ACTORS } from "./data/gerai-actors";
import { GERAI_F2_MAP_ID } from "./data/gerai-floor-2-map";
import { buildOfficeActors } from "./data/office-actors";
import { OFFICE_MAP_ID } from "./data/office-map";
import { buildActorsForStations } from "./data/real-agents";
import { fetchLiveAgentStatus } from "./live-agent-status";

const CAMPUS_MAP_IDS = new Set([CAMPUS_RECEPTION_MAP_ID, CAMPUS_PLAZA_MAP_ID]);

const CLIENT_FLOOR_STATIONS = new Map(
  CLIENT_FLOORS.map((build) => [build.floorMapId, build.stations]),
);

const CLIENT_FLOOR_WORKSPACE = new Map(
  CLIENT_FLOORS.map((build) => [build.floorMapId, build.workspaceId]),
);

async function fetchEngagedEmployeeIds(
  workspaceId: string,
): Promise<ReadonlySet<string>> {
  try {
    const project = await officeService.getProject(workspaceId);
    return new Set(project?.teamIds ?? []);
  } catch (error) {
    console.warn(
      "[office-domain] nao foi possivel confirmar o time do workspace, andar fica vazio",
      workspaceId,
      error,
    );
    return new Set();
  }
}

export class OfficeEntityProvider implements EntityProvider {
  async listActors(mapId: string): Promise<readonly ActorDescriptor[]> {
    if (CAMPUS_MAP_IDS.has(mapId)) {
      return [];
    }

    if (mapId === GERAI_F2_MAP_ID) {
      // Elenco proprio da Geraí (Nova/Pixel/Muse/...) — Residente
      // independente, sem ligacao com o Command Center do Lab. Fica
      // antes do guard de stations abaixo: Geraí nao usa esse mapa de
      // estacoes (aquele e so pro elenco real de client-floor-map.ts).
      return GERAI_F2_ACTORS;
    }

    const stations =
      mapId === OFFICE_MAP_ID ? undefined : CLIENT_FLOOR_STATIONS.get(mapId);
    if (mapId !== OFFICE_MAP_ID && !stations) {
      return [];
    }

    const liveStatus = await fetchLiveAgentStatus();
    if (mapId === OFFICE_MAP_ID) {
      return buildOfficeActors(liveStatus);
    }

    const workspaceId = CLIENT_FLOOR_WORKSPACE.get(mapId)!;
    const engagedIds = await fetchEngagedEmployeeIds(workspaceId);
    return buildActorsForStations(stations!, liveStatus, engagedIds);
  }
}
