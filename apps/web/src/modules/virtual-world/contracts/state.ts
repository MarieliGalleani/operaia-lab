/**
 * Salvamento/restauracao de estado visual (generico).
 *
 * Chaveado por `scopeId` (empresa/projeto), multiempresa/multiprojeto-ready.
 */

import type { CameraState } from "./camera";
import type { WorldTime } from "./clock";
import type { TileCoord } from "./ids";

export interface WorldViewState {
  readonly version: number;
  /** Escopo (ex.: empresa ou empresa:projeto). */
  readonly scopeId: string;
  readonly mapId: string;
  readonly floorId: string;
  readonly currentAreaId?: string;
  readonly selectedEntityId?: number;
  readonly avatarTile?: TileCoord;
  readonly camera: CameraState;
  readonly clock: WorldTime;
}

export interface StateStore {
  save(state: WorldViewState): void;
  load(scopeId: string): WorldViewState | undefined;
  clear(scopeId: string): void;
}
