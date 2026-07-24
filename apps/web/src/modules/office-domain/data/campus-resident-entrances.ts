/**
 * Registro de entradas de Residentes na Praça Central.
 *
 * A praça é um hub dinâmico: novos Residentes entram aqui (mapas + portal),
 * sem editar a geometria de campus-plaza-map. O Campus só conecta; cada
 * Residente é dono dos próprios mapas.
 */

import { GERAI_ENTRANCE_MAP_ID } from "./campus-ids";

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

/**
 * Residentes conectados à praça na Fase 1.
 * Adicionar Residente = novo item + mapas no catálogo (sem tocar nos maps Campus).
 */
export const CAMPUS_RESIDENT_ENTRANCES: readonly ResidentEntranceDef[] = [
  {
    residentId: "operaia-lab",
    label: "OperaIA.lab",
    portalId: "plaza-to-lab",
    targetMapId: "office",
    targetSpawnId: "from-campus",
    slot: 0,
  },
  {
    residentId: "gerai",
    label: "Geraí",
    portalId: "plaza-to-gerai",
    targetMapId: GERAI_ENTRANCE_MAP_ID,
    targetSpawnId: "from-plaza",
    slot: 1,
  },
];
