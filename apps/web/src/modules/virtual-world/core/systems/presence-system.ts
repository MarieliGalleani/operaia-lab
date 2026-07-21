/**
 * PresenceSystem — acompanha a PRESENÇA do actor local no mundo.
 *
 * A cada frame observa o `transform` do actor local (presence.local === true) e,
 * quando ele muda de tile, notifica via callback (o WorldRuntime usa isso para
 * persistir o estado). Genérico: só conhece presence + transform.
 */

import type { TileCoord } from "../../contracts/ids";
import type { System, SystemContext } from "../../contracts/systems";

export interface LocalPositionChange {
  readonly actorId: string;
  readonly from: TileCoord;
  readonly to: TileCoord;
}

export type LocalPositionListener = (change: LocalPositionChange) => void;

export class PresenceSystem implements System {
  readonly name = "presence";
  private lastKey: string | undefined;
  private lastTile: TileCoord | undefined;

  constructor(private readonly onLocalChange?: LocalPositionListener) {}

  update({ world }: SystemContext): void {
    for (const id of world.query("presence", "transform")) {
      const presence = world.get(id, "presence");
      const transform = world.get(id, "transform");
      if (!presence?.local || !transform) {
        continue;
      }
      const tile: TileCoord = {
        col: Math.round(transform.col),
        row: Math.round(transform.row),
        floorId: transform.floorId,
      };
      const key = `${tile.col},${tile.row},${tile.floorId}`;
      if (this.lastKey !== undefined && this.lastKey !== key && this.lastTile) {
        this.onLocalChange?.({ actorId: presence.actorId, from: this.lastTile, to: tile });
      }
      this.lastKey = key;
      this.lastTile = tile;
      return; // apenas um actor local por cliente
    }
  }

  /** Permite reiniciar o rastreamento (ex.: ao trocar de mapa). */
  reset(): void {
    this.lastKey = undefined;
    this.lastTile = undefined;
  }
}
