/**
 * MovementSystem — movimentação SIMPLES e genérica de qualquer Actor.
 *
 * Um "Actor" é apenas uma entidade com `transform` (position) + `movable`.
 * Este sistema NÃO sabe o que o actor representa (agente, npc, usuário…): apenas
 * desloca a `position` em direção a `movable.target` a `speedTilesPerSec`.
 * Sem pathfinding, colisão ou IA (movimento em linha reta até o destino).
 */

import type { EntityWorld } from "../../contracts/entities";
import type { EntityId, TileCoord } from "../../contracts/ids";
import type { System, SystemContext } from "../../contracts/systems";

function actorIdOf(world: EntityWorld, id: EntityId): string {
  return world.get(id, "presence")?.actorId ?? String(id);
}

export class MovementSystem implements System {
  readonly name = "movement";

  update({ world, bus, deltaMs }: SystemContext): void {
    const step = deltaMs / 1000;
    for (const id of world.query("movable", "transform")) {
      const movable = world.get(id, "movable");
      const transform = world.get(id, "transform");
      if (!movable || !transform || !movable.moving || !movable.target) {
        continue;
      }

      const target = movable.target;
      const dx = target.col - transform.col;
      const dy = target.row - transform.row;
      const distance = Math.hypot(dx, dy);
      const reach = movable.speedTilesPerSec * step;
      const from: TileCoord = { col: transform.col, row: transform.row, floorId: transform.floorId };

      if (distance === 0 || distance <= reach) {
        transform.col = target.col;
        transform.row = target.row;
        movable.moving = false;
        movable.target = undefined;
        bus.emit("actor:moved", {
          actorId: actorIdOf(world, id),
          from,
          to: { col: target.col, row: target.row, floorId: transform.floorId },
        });
      } else {
        transform.col += (dx / distance) * reach;
        transform.row += (dy / distance) * reach;
      }
    }
  }
}

/** Comanda um Actor a caminhar até um tile (usado pelo domínio/UI no futuro). */
export function commandMove(world: EntityWorld, id: EntityId, target: TileCoord): void {
  const movable = world.get(id, "movable");
  if (!movable) {
    return;
  }
  movable.target = { col: target.col, row: target.row, floorId: target.floorId };
  movable.moving = true;
}
