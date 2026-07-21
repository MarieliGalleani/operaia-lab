/**
 * PortalSystem — travessia GENÉRICA entre mapas.
 *
 * Detecta quando um Actor (presence + transform) ocupa o tile de um Portal
 * (portal + transform) e emite `portal:entered`. Debounce por "actor|portal":
 * emite só na ENTRADA (transição de fora→dentro), não a cada frame.
 *
 * Sem conhecimento de negócio: o destino vem do dado do próprio portal
 * (`portal.target = { mapId, spawnPointId }`). Quem carrega o mapa é o
 * WorldRuntime, ao reagir ao evento.
 */

import type { System, SystemContext } from "../../contracts/systems";

export class PortalSystem implements System {
  readonly name = "portal";
  private previous = new Set<string>();

  update({ world, bus }: SystemContext): void {
    const portals = world.query("portal", "transform");
    if (portals.length === 0) {
      this.previous.clear();
      return;
    }
    const actors = world.query("presence", "transform");
    const current = new Set<string>();

    for (const actorEntity of actors) {
      const at = world.get(actorEntity, "transform");
      const presence = world.get(actorEntity, "presence");
      if (!at || !presence) {
        continue;
      }
      const col = Math.round(at.col);
      const row = Math.round(at.row);

      for (const portalEntity of portals) {
        const pt = world.get(portalEntity, "transform");
        const portal = world.get(portalEntity, "portal");
        if (!pt || !portal || pt.floorId !== at.floorId) {
          continue;
        }
        if (col !== pt.col || row !== pt.row) {
          continue;
        }
        const key = `${presence.actorId}|${portal.portalId}`;
        current.add(key);
        if (!this.previous.has(key)) {
          bus.emit("portal:entered", {
            actorId: presence.actorId,
            portalId: portal.portalId,
            targetMapId: portal.target.mapId,
            targetSpawnId: portal.target.spawnPointId,
          });
        }
      }
    }

    this.previous = current;
  }
}
