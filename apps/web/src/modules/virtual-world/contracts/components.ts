/**
 * COMPONENTES genericos do ECS.
 *
 * Um componente e apenas DADO (serializavel). A engine conhece SOMENTE estes
 * conceitos genericos. Nao existem "Agent", "Door", "Elevator" ou "Monitor"
 * como componentes — esses sao PREFABS de dados montados sobre os genericos:
 *   - Door/Elevator  = renderable + portal + interactable
 *   - Monitor/Computer = renderable + state
 *   - Agent/NPC/Avatar = renderable + movable + presence + state (+ interactable)
 */

import type { TileCoord, TileRect } from "./ids";

/** Direcao de face (8 direcoes isometricas). */
export type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Camadas de render (ordem de profundidade). Generico. */
export type RenderLayer = "floor" | "walls" | "objects" | "actors" | "overlay";

/** Tipos genericos de interacao (sem semantica de negocio). */
export type InteractionKind = "actor" | "object" | "portal" | "area";

/** Modo de travessia de um portal. */
export type PortalMode = "walk" | "instant";

/** Categoria generica de um ator (para presenca/multiplayer). */
export type ActorKind = "user" | "agent" | "guest";

/** Posicao e orientacao no mundo. */
export interface TransformComponent {
  col: number;
  row: number;
  floorId: string;
  facing: Direction;
}

/** Aparencia: qual sprite e em qual camada. O sprite vem do pipeline de assets. */
export interface RenderableComponent {
  spriteId: string;
  layer: RenderLayer;
  visible: boolean;
  tint?: number;
}

/** Capacidade de mover-se por tiles (o pathfinding preenche `path`). */
export interface MovableComponent {
  speedTilesPerSec: number;
  path: readonly TileCoord[];
  moving: boolean;
  target?: TileCoord;
}

/** Torna a entidade clicavel/interativa (mecanismo generico). */
export interface InteractableComponent {
  kind: InteractionKind;
  radiusTiles: number;
  enabled: boolean;
  label?: string;
}

/**
 * Recinto/regiao logica do mapa. `kind` e uma STRING de dado (ex.: "reception",
 * "lab", "datacenter") — a engine nunca interpreta o valor.
 */
export interface AreaComponent {
  areaId: string;
  floorId: string;
  bounds: TileRect;
  kind: string;
  tags: readonly string[];
}

/** Ligacao generica entre mapas/areas (substitui Door e Elevator). */
export interface PortalComponent {
  portalId: string;
  target: { readonly mapId: string; readonly spawnPointId: string };
  mode: PortalMode;
  label?: string;
}

/**
 * Estado generico de uma entidade. `current` e uma string de dado; qualquer
 * semantica (ex.: "on"/"off", "WORKING") pertence ao dominio, nao a engine.
 */
export interface StateComponent {
  current: string;
  values?: Readonly<Record<string, number | string | boolean>>;
}

/** Animacao em curso (clip logico; o motor decide como desenhar). */
export interface AnimationComponent {
  clip: string;
  loop: boolean;
  startedAtMs: number;
}

/** Presenca de um ator no mundo (multiplayer-ready). */
export interface PresenceComponent {
  actorId: string;
  displayName: string;
  kind: ActorKind;
  local: boolean;
  color?: string;
}
