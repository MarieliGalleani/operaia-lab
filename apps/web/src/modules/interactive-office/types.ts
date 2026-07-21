/**
 * Contratos do Interactive Office.
 *
 * Camadas separadas: DADOS (providers) -> ESTADO (este módulo de tipos) ->
 * ENGINE (movimentação) -> RENDER. Nenhuma regra de negócio mora aqui.
 */

export type OfficeStateId =
  | "AVAILABLE"
  | "THINKING"
  | "ANALYZING"
  | "PLANNING"
  | "DEVELOPING"
  | "AUTOMATING"
  | "MEETING"
  | "WAITING"
  | "BLOCKED"
  | "OFFLINE";

/** Posição em coordenadas de tile (fracionária durante a caminhada). */
export interface Tile {
  col: number;
  row: number;
}

export type RoomKind =
  | "department"
  | "executive"
  | "reception"
  | "meeting"
  | "library"
  | "lounge"
  | "project"
  | "common";

export interface RoomDef {
  id: string;
  label: string;
  emoji: string;
  kind: RoomKind;
  /** Retângulo em tiles: canto superior + tamanho. */
  col: number;
  row: number;
  w: number;
  h: number;
  tint: string;
}

export interface StateVisual {
  label: string;
  icon: string;
  color: string;
}

/** Funcionário no escritório (estado vivo + presença). */
export interface OfficeEmployee {
  id: string;
  name: string;
  role: string;
  emoji: string;
  specialtyLabel: string;
  mission: string;
  hired: boolean;
  roomId: string;
  homeTile: Tile;
  /** Posição atual (mutável pela engine). */
  tile: Tile;
  /** Duração da transição de caminhada em ms (0 = teleporte). */
  moveMs: number;
  moving: boolean;
  state: OfficeStateId;
  carryingTask: boolean;
  currentProjectId?: string;
  lastActivity: string;
}

export interface OfficeWorkspace {
  id: string;
  name: string;
  emoji: string;
  objective: string;
  status: string;
  progress: number;
  roomId: string;
  teamIds: readonly string[];
}

export interface OfficeEvent {
  id: string;
  time: string;
  actorId: string;
  message: string;
  kind: string;
}
