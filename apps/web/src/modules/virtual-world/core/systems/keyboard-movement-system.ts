/**
 * KeyboardMovementSystem — movimento CONTÍNUO por input direcional.
 *
 * Complementa o MovementSystem (que é baseado em alvo/tile). Aqui o movimento
 * é dirigido por um `DirectionalInput` (WASD + setas), baseado em delta time,
 * atualizando o `TransformComponent` do actor local e emitindo `entity:moved`.
 *
 * Genérico: só conhece presence (local) + transform + movable. Nenhuma regra de
 * escritório, sala, cargo ou agente. A engine apenas move UMA entidade no mundo.
 */

import type { Direction } from "../../contracts/components";
import type { TileCoord } from "../../contracts/ids";
import type { System, SystemContext } from "../../contracts/systems";
import type { DirectionalInput } from "../input/keyboard-input";

const DEFAULT_SPEED_TILES_PER_SEC = 4;

/** Converte um vetor de direção em uma das 8 direções de face. */
function directionFromVector(dx: number, dy: number): Direction | undefined {
  const horizontal = dx > 0 ? "e" : dx < 0 ? "w" : "";
  const vertical = dy > 0 ? "s" : dy < 0 ? "n" : "";
  const facing = `${vertical}${horizontal}`;
  return facing === "" ? undefined : (facing as Direction);
}

export class KeyboardMovementSystem implements System {
  readonly name = "keyboard-movement";

  constructor(
    private readonly input: DirectionalInput,
    private readonly defaultSpeed = DEFAULT_SPEED_TILES_PER_SEC,
  ) {}

  update({ world, bus, deltaMs }: SystemContext): void {
    const { dx, dy } = this.input.getDirection();
    if (dx === 0 && dy === 0) {
      return;
    }

    for (const id of world.query("presence", "transform")) {
      const presence = world.get(id, "presence");
      const transform = world.get(id, "transform");
      if (!presence?.local || !transform) {
        continue;
      }

      const speed = world.get(id, "movable")?.speedTilesPerSec ?? this.defaultSpeed;
      const step = (deltaMs / 1000) * speed;
      const from: TileCoord = { col: transform.col, row: transform.row, floorId: transform.floorId };

      transform.col += dx * step;
      transform.row += dy * step;
      const facing = directionFromVector(dx, dy);
      if (facing) {
        transform.facing = facing;
      }

      bus.emit("entity:moved", {
        entityId: id,
        from,
        to: { col: transform.col, row: transform.row, floorId: transform.floorId },
      });
      return; // apenas o actor local é controlável por teclado
    }
  }
}
