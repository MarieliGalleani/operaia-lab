/**
 * Registro de entradas de Residentes na Praça Central.
 *
 * A praça é um hub dinâmico: novos Residentes entram aqui (mapas + portal),
 * sem editar a geometria de campus-plaza-map. O Campus só conecta; cada
 * Residente é dono dos próprios mapas.
 *
 * Residentes = clientes reais (workspaces classificados como "client" no
 * backend, workspace-catalog.ts) + a própria sede OperaIA.lab. Um cliente
 * novo = um item aqui + em client-floors-registry.ts, nada mais.
 */

import { GERAI_ENTRANCE_MAP_ID } from "./campus-ids";
import { CLIENT_FLOORS } from "./client-floors-registry";

/** Slot visual na praça (posição relativa das fachadas). */
export interface ResidentEntranceDef {
  readonly residentId: string;
  readonly label: string;
  readonly portalId: string;
  readonly targetMapId: string;
  readonly targetSpawnId: string;
  /** Índice de fachada na fileira sul da praça (0..n). */
  readonly slot: number;
}

const LAB_ENTRANCE: ResidentEntranceDef = {
  residentId: "operaia-lab",
  label: "OperaIA.lab",
  portalId: "plaza-to-lab",
  targetMapId: "office",
  targetSpawnId: "from-campus",
  slot: 0,
};

/**
 * Geraí tinha mapas e elenco prontos (gerai-entrance-map.ts,
 * gerai-floor-2-map.ts) mas nunca teve entrada registrada aqui nem no
 * catalogo do mundo (office-map-provider.ts) — na pratica, Residente
 * documentado como "sede integrada" que nao dava pra visitar.
 */
const GERAI_ENTRANCE: ResidentEntranceDef = {
  residentId: "gerai",
  label: "Geraí",
  portalId: "plaza-to-gerai",
  targetMapId: GERAI_ENTRANCE_MAP_ID,
  targetSpawnId: "from-plaza",
  slot: 1,
};

const CLIENT_ENTRANCES: readonly ResidentEntranceDef[] = CLIENT_FLOORS.map(
  (build, index) => ({
    residentId: build.entranceMapId.replace(/-entrance$/, ""),
    label: build.entranceMap.name.replace(/ — Entrada$/, ""),
    portalId: `plaza-to-${build.entranceMapId.replace(/-entrance$/, "")}`,
    targetMapId: build.entranceMapId,
    targetSpawnId: "from-plaza",
    slot: index + 2, // 0 = Lab, 1 = Geraí
  }),
);

/**
 * Residentes conectados à praça hoje: a sede + Geraí + os clientes reais.
 * Adicionar Residente = novo item + mapas no catálogo (sem tocar nos maps Campus).
 */
export const CAMPUS_RESIDENT_ENTRANCES: readonly ResidentEntranceDef[] = [
  LAB_ENTRANCE,
  GERAI_ENTRANCE,
  ...CLIENT_ENTRANCES,
];
