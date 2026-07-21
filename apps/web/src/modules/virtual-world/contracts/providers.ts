/**
 * PROVIDERS de dados da engine (genericos).
 *
 * A engine consome apenas dados genericos: mapas, atores, assets e presenca.
 * NENHum conceito de negocio/IA aqui. O dominio (ex.: escritorio) implementa
 * estes providers traduzindo suas regras para dados genericos.
 */

import type { AssetProvider } from "./assets";
import type { ActorKind } from "./components";
import type { TileCoord, Unsubscribe } from "./ids";
import type { MapManifest, MapSummary } from "./map";
import type { PresenceProvider } from "./presence";

/** Descritor generico de um ator (agente, npc, usuario). Sem campos de negocio. */
export interface ActorDescriptor {
  readonly id: string;
  readonly name: string;
  readonly kind: ActorKind;
  /** Onde nasce (spawn nomeado do mapa) ou tile fixo. */
  readonly spawnPointId?: string;
  readonly homeTile?: TileCoord;
  /** Estado inicial (string de dado; semantica pertence ao dominio). */
  readonly stateId: string;
  readonly spriteId?: string;
  readonly tags?: readonly string[];
}

/** Mudanca de estado de um ator (stream em tempo real no futuro). */
export interface ActorStateEvent {
  readonly actorId: string;
  readonly stateId: string;
  readonly previous: string;
}

/** Fornece mapas por id (e lista catalogos). */
export interface MapProvider {
  getMap(mapId: string): Promise<MapManifest>;
  listMaps(scopeId: string): Promise<readonly MapSummary[]>;
}

/** Fornece atores genericos de um mapa. */
export interface EntityProvider {
  listActors(mapId: string): Promise<readonly ActorDescriptor[]>;
  subscribe?(handler: (event: ActorStateEvent) => void): Unsubscribe;
}

/** Agregado de providers necessarios a engine. */
export interface WorldDataProvider {
  readonly kind: string;
  readonly maps: MapProvider;
  readonly entities: EntityProvider;
  readonly assets: AssetProvider;
  readonly presence: PresenceProvider;
}
