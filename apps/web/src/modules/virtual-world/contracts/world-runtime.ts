/**
 * Runtime do mundo — a camada de comunicacao que costura tudo.
 *
 * Reune EventBus + ECS + Clock + Camera + Scheduler + StateStore + Provider +
 * Engine. A casca Vue so manipula o WorldRuntime (via o wrapper <VirtualWorld>).
 * Suporta troca de mapa por id (portais), preparando multi-mapa desde ja.
 */

import type { CameraController } from "./camera";
import type { WorldClock } from "./clock";
import type { EntityWorld } from "./entities";
import type { EventBus } from "./events";
import type { EntityId, TileCoord } from "./ids";
import type { WorldDataProvider } from "./providers";
import type { StateStore } from "./state";
import type { SystemScheduler } from "./systems";
import type { WorldEngine } from "./world-engine";

export interface WorldRuntimeOptions {
  /** Escopo (empresa/projeto) — multiempresa/multiprojeto-ready. */
  readonly scopeId: string;
  /** Mapa inicial a carregar. */
  readonly initialMapId: string;
  readonly data: WorldDataProvider;
  readonly engine: WorldEngine;
  readonly clockScale?: number;
  readonly stateStore?: StateStore;
  readonly bus?: EventBus;
  readonly world?: EntityWorld;
}

export interface WorldRuntime {
  readonly scopeId: string;
  readonly providerKind: string;
  readonly currentMapId: string | undefined;

  readonly bus: EventBus;
  readonly world: EntityWorld;
  readonly clock: WorldClock;
  readonly camera: CameraController;
  readonly scheduler: SystemScheduler;
  readonly state: StateStore;
  readonly engine: WorldEngine;

  /** Actor local (usuário conectado) presente no mapa atual, se houver. */
  readonly localActorId: EntityId | undefined;
  /** Posição (tile) atual do actor local. */
  getLocalActorTile(): TileCoord | undefined;
  /** Comanda o actor local a caminhar até um tile (movimento simples). */
  moveLocalActorTo(tile: TileCoord): void;
  /** Teleporta o actor local para um spawnPoint do mapa atual (sem recarregar). */
  teleportLocalActorTo(spawnId: string): void;

  /** Zoom relativo da câmera (>1 aproxima, <1 afasta). Genérico. */
  zoomCameraBy(factor: number): void;
  /** Reativa o "seguir" e recentraliza a câmera no actor local. */
  recenterCamera(): void;
  /** Liga/desliga o acompanhamento do actor local (câmera livre = false). */
  setCameraFollow(enabled: boolean): void;

  /** Inicializa o motor e carrega o mapa inicial (por dados). */
  start(container: HTMLElement): Promise<void>;
  /** Troca o mapa atual (usado por portais). Transparente. */
  loadMap(mapId: string): Promise<void>;
  /** Encerra tudo e libera recursos. */
  dispose(): void;
  readonly started: boolean;
}
