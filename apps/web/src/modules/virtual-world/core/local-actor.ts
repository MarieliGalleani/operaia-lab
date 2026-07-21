/**
 * LocalActor — o Actor controlável que representa o USUÁRIO conectado.
 *
 * Continua sendo um Actor GENÉRICO (id + transform/position + sprite + state):
 * a única diferença é `presence.local = true`. Nenhum conceito de negócio
 * (funcionário, CEO, agente, colaborador) existe aqui — quem é o usuário é
 * decidido fora da engine (PresenceProvider do domínio/app).
 */

import type { EntityWorld } from "../contracts/entities";
import type { EventBus } from "../contracts/events";
import type { EntityId } from "../contracts/ids";
import type { MapManifest } from "../contracts/map";
import type { PresenceActor } from "../contracts/presence";
import { resolveSpawnPoint } from "./actor-loader";

/** Estado inicial genérico do actor local (string de dado; sem semântica de negócio). */
const DEFAULT_STATE = "IDLE";
const LOCAL_SPEED_TILES_PER_SEC = 4;

/**
 * Cria o actor local no ECS. A POSIÇÃO INICIAL vem do MapManifest
 * (spawnPointId informado ou o defaultSpawn do mapa).
 */
export function spawnLocalActor(
  world: EntityWorld,
  actor: PresenceActor,
  manifest: MapManifest,
  bus: EventBus,
  spawnPointId?: string,
): EntityId {
  const spawn = resolveSpawnPoint(manifest, spawnPointId);
  const id = world.spawn({
    presence: {
      actorId: actor.id,
      displayName: actor.displayName,
      kind: actor.kind,
      local: true,
      color: actor.color,
    },
    transform: {
      col: spawn.col,
      row: spawn.row,
      floorId: spawn.floorId,
      facing: spawn.facing ?? "s",
    },
    renderable: { spriteId: "local-actor", layer: "actors", visible: true },
    state: { current: DEFAULT_STATE },
    movable: { speedTilesPerSec: LOCAL_SPEED_TILES_PER_SEC, path: [], moving: false },
  });

  bus.emit("entity:spawned", { entityId: id });
  bus.emit("presence:joined", {
    actor: {
      id: actor.id,
      displayName: actor.displayName,
      kind: actor.kind,
      local: true,
      color: actor.color,
      tile: { col: spawn.col, row: spawn.row, floorId: spawn.floorId },
    },
  });
  return id;
}
