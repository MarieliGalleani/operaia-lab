/**
 * EVENTOS genericos do mundo + contrato do EventBus tipado.
 *
 * Todo comportamento e orientado a eventos. Este mapa contem SOMENTE eventos
 * genericos da engine. Eventos de negocio (conversa, missao, projeto) pertencem
 * a um mapa de eventos de DOMINIO, definido fora da engine.
 */

import type { CameraState } from "./camera";
import type { WorldTime } from "./clock";
import type { InteractionKind } from "./components";
import type { EntityId, TileCoord, Unsubscribe } from "./ids";
import type { PresenceActor } from "./presence";

export interface WorldEventMap {
  // ciclo de vida
  "world:ready": { readonly engine: string };
  "world:disposed": Record<string, never>;
  "world:error": { readonly message: string };

  // mapas e portais
  "map:loaded": { readonly mapId: string };
  "map:changed": { readonly fromMapId?: string; readonly toMapId: string };
  /**
   * Chegada de ALTO NÍVEL de um ator a um mapa (após load OU teleporte interno).
   * Ponto de extensão genérico para o domínio (quests, música, iluminação,
   * spawning de NPCs, UI, missões) — sem colocar essas regras na engine.
   */
  "map:entered": {
    readonly actorId: string;
    readonly mapId: string;
    readonly spawnId: string;
  };
  "portal:entered": {
    readonly actorId: string;
    readonly portalId: string;
    readonly targetMapId: string;
    readonly targetSpawnId: string;
  };

  // tempo e camera
  "clock:tick": { readonly time: WorldTime; readonly deltaMs: number };
  "camera:moved": { readonly state: CameraState };

  // navegacao
  "tile:clicked": { readonly tile: TileCoord; readonly actorId?: string };
  "actor:moved": { readonly actorId: string; readonly from: TileCoord; readonly to: TileCoord };
  "actor:entered-area": {
    readonly actorId: string;
    readonly areaId: string;
    readonly previousAreaId?: string;
  };

  // entidades (generico — sem semantica de negocio)
  "entity:selected": { readonly entityId: EntityId };
  "entity:interacted": {
    readonly entityId: EntityId;
    readonly actorId: string;
    readonly interactionKind: InteractionKind;
  };
  "entity:state-changed": {
    readonly entityId: EntityId;
    readonly current: string;
    readonly previous: string;
  };
  "entity:spawned": { readonly entityId: EntityId };
  "entity:removed": { readonly entityId: EntityId };
  "entity:moved": {
    readonly entityId: EntityId;
    readonly from: TileCoord;
    readonly to: TileCoord;
  };

  // presenca (multiplayer-ready)
  "presence:joined": { readonly actor: PresenceActor };
  "presence:left": { readonly actorId: string };
}

export type WorldEventType = keyof WorldEventMap;

export type WorldEventHandler<K extends WorldEventType> = (
  payload: WorldEventMap[K],
) => void;

export interface EventBus {
  on<K extends WorldEventType>(type: K, handler: WorldEventHandler<K>): Unsubscribe;
  once<K extends WorldEventType>(type: K, handler: WorldEventHandler<K>): Unsubscribe;
  off<K extends WorldEventType>(type: K, handler: WorldEventHandler<K>): void;
  emit<K extends WorldEventType>(type: K, payload: WorldEventMap[K]): void;
  clear(): void;
}
