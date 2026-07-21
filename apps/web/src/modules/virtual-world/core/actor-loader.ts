/**
 * Carregador de Actors — spawna atores GENÉRICOS no ECS.
 *
 * Um Actor é apenas: id + position + sprite + state (mapeados para os
 * componentes genéricos presence/transform/renderable/state, + movable para
 * permitir movimento). A POSIÇÃO INICIAL vem do MapManifest (spawn points).
 *
 * A engine e este loader NÃO sabem quem é o actor — o domínio (via
 * EntityProvider) fornece os ActorDescriptors; aqui só viram entidades.
 */

import type { EntityWorld } from "../contracts/entities";
import type { Direction } from "../contracts/components";
import type { MapManifest } from "../contracts/map";
import type { EventBus } from "../contracts/events";
import type { ActorDescriptor } from "../contracts/providers";

export interface ResolvedSpawn {
  readonly col: number;
  readonly row: number;
  readonly floorId: string;
  readonly facing?: Direction;
}

function findSpawnPoint(manifest: MapManifest, spawnId: string): ResolvedSpawn | undefined {
  for (const floor of manifest.floors) {
    for (const spawn of floor.spawnPoints) {
      if (spawn.id === spawnId) {
        return { col: spawn.col, row: spawn.row, floorId: floor.id, facing: spawn.facing };
      }
    }
  }
  return undefined;
}

/** Seleção de spawn: id efetivo + ponto resolvido + se o solicitado existia. */
export interface SpawnSelection {
  readonly spawnId: string;
  readonly point: ResolvedSpawn;
  /** false quando o spawnPointId solicitado não existe (usou-se o defaultSpawn). */
  readonly existed: boolean;
}

/**
 * Seleciona o spawn a partir de um id solicitado, com fallback para o
 * defaultSpawn do mapa. Informa `existed` para que a navegação possa avisar em
 * desenvolvimento sem quebrar a execução.
 */
export function selectSpawn(manifest: MapManifest, spawnPointId?: string): SpawnSelection {
  const requested = spawnPointId ?? manifest.defaultSpawn.spawnPointId;
  const direct = findSpawnPoint(manifest, requested);
  if (direct) {
    return { spawnId: requested, point: direct, existed: true };
  }
  const byDefault = findSpawnPoint(manifest, manifest.defaultSpawn.spawnPointId);
  if (byDefault) {
    return { spawnId: manifest.defaultSpawn.spawnPointId, point: byDefault, existed: false };
  }
  const firstFloor = manifest.floors[0];
  return {
    spawnId: manifest.defaultSpawn.spawnPointId,
    point: { col: 0, row: 0, floorId: firstFloor ? firstFloor.id : manifest.defaultSpawn.floorId },
    existed: false,
  };
}

/** Resolve um spawn nomeado do MapManifest (com fallback para o defaultSpawn). */
export function resolveSpawnPoint(manifest: MapManifest, spawnPointId?: string): ResolvedSpawn {
  return selectSpawn(manifest, spawnPointId).point;
}

/** Resolve a posição inicial de um actor exclusivamente a partir do MapManifest. */
function resolveSpawn(manifest: MapManifest, actor: ActorDescriptor): ResolvedSpawn {
  if (actor.spawnPointId) {
    const byId = findSpawnPoint(manifest, actor.spawnPointId);
    if (byId) {
      return byId;
    }
  }
  if (actor.homeTile) {
    return {
      col: actor.homeTile.col,
      row: actor.homeTile.row,
      floorId: actor.homeTile.floorId ?? manifest.defaultSpawn.floorId,
    };
  }
  const fallback = findSpawnPoint(manifest, manifest.defaultSpawn.spawnPointId);
  if (fallback) {
    return fallback;
  }
  const firstFloor = manifest.floors[0];
  return { col: 0, row: 0, floorId: firstFloor ? firstFloor.id : manifest.defaultSpawn.floorId };
}

export interface ActorLoadResult {
  readonly spawned: number;
}

export function spawnActorsIntoWorld(
  world: EntityWorld,
  actors: readonly ActorDescriptor[],
  manifest: MapManifest,
  bus: EventBus,
): ActorLoadResult {
  let spawned = 0;
  for (const actor of actors) {
    const spawn = resolveSpawn(manifest, actor);
    const id = world.spawn({
      presence: {
        actorId: actor.id,
        displayName: actor.name,
        kind: actor.kind,
        local: false,
      },
      transform: {
        col: spawn.col,
        row: spawn.row,
        floorId: spawn.floorId,
        facing: spawn.facing ?? "s",
      },
      renderable: { spriteId: actor.spriteId ?? "actor", layer: "actors", visible: true },
      state: { current: actor.stateId },
      movable: { speedTilesPerSec: 3, path: [], moving: false },
    });
    bus.emit("entity:spawned", { entityId: id });
    bus.emit("presence:joined", {
      actor: {
        id: actor.id,
        displayName: actor.name,
        kind: actor.kind,
        local: false,
        tile: { col: spawn.col, row: spawn.row, floorId: spawn.floorId },
      },
    });
    spawned += 1;
  }
  return { spawned };
}
