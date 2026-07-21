/**
 * Carregador de mapa: transforma DADOS (MapManifest) em ENTIDADES (ECS).
 *
 * Prova de que qualquer ambiente nasce de dados, nunca desenhado em codigo.
 * Funciona para escritorio, campus, laboratorio, etc. — a engine nao ramifica
 * por "tipo de ambiente".
 */

import type { ComponentBundle } from "../contracts/entities";
import type { EntityWorld } from "../contracts/entities";
import type { EventBus } from "../contracts/events";
import type { EntityBlueprint, MapManifest } from "../contracts/map";

function toBundle(blueprint: EntityBlueprint, floorId: string): ComponentBundle {
  const c = blueprint.components;
  const bundle: ComponentBundle = {
    transform: {
      col: c.transform.col,
      row: c.transform.row,
      floorId: c.transform.floorId ?? floorId,
      facing: c.transform.facing ?? "s",
    },
  };
  if (c.renderable) {
    bundle.renderable = c.renderable;
  }
  if (c.interactable) {
    bundle.interactable = c.interactable;
  }
  if (c.portal) {
    bundle.portal = c.portal;
  }
  if (c.state) {
    bundle.state = c.state;
  }
  if (c.animation) {
    bundle.animation = c.animation;
  }
  if (c.presence) {
    bundle.presence = c.presence;
  }
  if (c.movable) {
    bundle.movable = c.movable;
  }
  return bundle;
}

export interface MapLoadResult {
  readonly areas: number;
  readonly entities: number;
  readonly portals: number;
}

/** Popula o mundo (ECS) a partir do manifesto. Emite `entity:spawned`. */
export function loadManifestIntoWorld(
  world: EntityWorld,
  manifest: MapManifest,
  bus: EventBus,
): MapLoadResult {
  let areas = 0;
  let entities = 0;
  let portals = 0;

  for (const floor of manifest.floors) {
    for (const area of floor.areas) {
      const areaEntity = world.spawn({
        area: {
          areaId: area.id,
          floorId: floor.id,
          bounds: area.bounds,
          kind: area.kind,
          tags: area.tags ?? [],
        },
      });
      bus.emit("entity:spawned", { entityId: areaEntity });
      areas += 1;

      for (const decoration of area.decorations) {
        const id = world.spawn(toBundle(decoration, floor.id));
        bus.emit("entity:spawned", { entityId: id });
        entities += 1;
      }
    }

    for (const blueprint of floor.entities) {
      const bundle = toBundle(blueprint, floor.id);
      const id = world.spawn(bundle);
      bus.emit("entity:spawned", { entityId: id });
      entities += 1;
      if (bundle.portal) {
        portals += 1;
      }
    }
  }

  return { areas, entities, portals };
}
