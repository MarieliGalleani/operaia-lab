/**
 * CameraFollowSystem — acompanha uma entidade alvo com dead zone + suavização.
 *
 * Estilo de jogos de gerenciamento/simulação modernos:
 *  - dead zone: dentro do raio, a câmera NÃO micro-ajusta (evita "luta");
 *  - fora do raio: aproxima-se suavemente (exponencial, independente de FPS);
 *  - snap: centralização imediata (recenter / load de mapa).
 *
 * Genérico: só conhece target entity + Transform + projeção tile→mundo.
 */

import type { CameraController } from "../../contracts/camera";
import type { EntityWorld } from "../../contracts/entities";
import type { EntityId } from "../../contracts/ids";
import type { System, SystemContext } from "../../contracts/systems";
import { tileToWorld } from "../geometry/iso";

export interface CameraFollowOptions {
  /** Velocidade de aproximação (por segundo). Maior = mais "grudado". */
  readonly smoothing?: number;
  /**
   * Raio (px de mundo) em torno do centro da câmera onde o alvo pode se
   * mover sem puxar a câmera. Menor = acompanha mais de perto.
   */
  readonly deadZonePx?: number;
}

/** Suavização mais responsiva que o default antigo (8), sem ficar rígida. */
const DEFAULT_SMOOTHING = 10;
/** Dead zone pequena (~meio tile em 64px) — avatar fica perto do centro. */
const DEFAULT_DEAD_ZONE_PX = 28;

export class CameraFollowSystem implements System {
  readonly name = "camera-follow";

  private targetId: EntityId | undefined;
  private tileW = 0;
  private tileH = 0;
  private enabled = true;
  private readonly smoothing: number;
  private readonly deadZonePx: number;

  constructor(
    private readonly camera: CameraController,
    options: CameraFollowOptions = {},
  ) {
    this.smoothing = options.smoothing ?? DEFAULT_SMOOTHING;
    this.deadZonePx = options.deadZonePx ?? DEFAULT_DEAD_ZONE_PX;
  }

  setTarget(id: EntityId | undefined): void {
    this.targetId = id;
  }

  /** Liga/desliga o acompanhamento (câmera livre quando desligado). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setTileSize(tileWidth: number, tileHeight: number): void {
    this.tileW = tileWidth;
    this.tileH = tileHeight;
  }

  /** Centraliza imediatamente no alvo (sem interpolação), ex.: ao carregar mapa. */
  snapToTarget(world: EntityWorld): void {
    const point = this.resolveTargetPoint(world);
    if (point) {
      this.camera.moveTo(point.x, point.y);
    }
  }

  update({ world, deltaMs }: SystemContext): void {
    if (!this.enabled) {
      return;
    }
    const point = this.resolveTargetPoint(world);
    if (!point) {
      return;
    }
    const state = this.camera.getState();
    const dx = point.x - state.x;
    const dy = point.y - state.y;
    const dist = Math.hypot(dx, dy);

    // Dentro da dead zone: não move — movimento do jogador permanece fluido.
    if (dist <= this.deadZonePx) {
      return;
    }

    // Puxa só o excesso além da dead zone (soft follow), com suavização.
    const excess = dist - this.deadZonePx;
    const pullX = state.x + (dx / dist) * excess;
    const pullY = state.y + (dy / dist) * excess;
    const dt = deltaMs / 1000;
    const factor = 1 - Math.exp(-this.smoothing * dt);
    this.camera.moveTo(state.x + (pullX - state.x) * factor, state.y + (pullY - state.y) * factor);
  }

  private resolveTargetPoint(world: EntityWorld): { x: number; y: number } | undefined {
    if (this.targetId === undefined || !this.tileW || !this.tileH) {
      return undefined;
    }
    const transform = world.get(this.targetId, "transform");
    if (!transform) {
      return undefined;
    }
    return tileToWorld(transform.col, transform.row, this.tileW, this.tileH);
  }
}
