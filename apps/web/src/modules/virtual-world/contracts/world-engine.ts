/**
 * Porta (interface) do MOTOR GRAFICO — a fronteira substituivel.
 *
 * A casca Vue e o runtime conhecem APENAS esta interface, nunca o PixiJS.
 * O motor conhece somente conceitos genericos (mapas, entidades, camera).
 */

import type { AssetProvider } from "./assets";
import type { CameraController } from "./camera";
import type { WorldClock } from "./clock";
import type { EntityWorld } from "./entities";
import type { EventBus } from "./events";
import type { MapManifest } from "./map";

export interface WorldEngineContext {
  readonly container: HTMLElement;
  readonly bus: EventBus;
  readonly world: EntityWorld;
  readonly clock: WorldClock;
  readonly camera: CameraController;
  readonly assets: AssetProvider;
}

export interface WorldEngine {
  /** Identificador do motor (ex.: "null", "pixi"). */
  readonly id: string;
  init(context: WorldEngineContext): Promise<void>;
  /** Carrega/troca o mapa atual (dados -> cena). */
  loadMap(manifest: MapManifest): Promise<void>;
  resize(width: number, height: number): void;
  destroy(): void;
}

export type WorldEngineFactory = () => WorldEngine;
