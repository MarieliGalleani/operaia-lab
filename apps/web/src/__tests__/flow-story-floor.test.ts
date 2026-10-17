import { describe, expect, it } from "vitest";

import { TypedEventBus } from "@/modules/virtual-world/core/event-bus";
import { EcsWorld } from "@/modules/virtual-world/core/ecs/ecs-world";
import { loadManifestIntoWorld } from "@/modules/virtual-world/core/map-loader";
import { FLOW_STORY_MAP, FLOW_STORY_MAP_ID } from "@/modules/office-domain/data/flow-story-floor-map";
import { OFFICE_MAP } from "@/modules/office-domain/data/office-map";
import { OfficeEntityProvider } from "@/modules/office-domain/office-entity-provider";
import { OfficeMapProvider } from "@/modules/office-domain/office-map-provider";

function portalsOf(map: typeof OFFICE_MAP) {
  return map.floors.flatMap((f) =>
    f.entities.flatMap((e) => (e.components.portal ? [e.components.portal] : [])),
  );
}

describe("1º andar Flow Story", () => {
  it("carrega como mapa de dados no nível 1 com 6 salas e o elevador", () => {
    const world = new EcsWorld();
    const result = loadManifestIntoWorld(world, FLOW_STORY_MAP, new TypedEventBus());
    expect(result.areas).toBe(6);
    expect(result.portals).toBe(1);
    expect(FLOW_STORY_MAP.floors[0]?.level).toBe(1);
  });

  it("elevador liga a recepção da sede ao andar e volta (spawns existem dos dois lados)", () => {
    const up = portalsOf(OFFICE_MAP).find((p) => p.target.mapId === FLOW_STORY_MAP_ID);
    expect(up).toBeDefined();
    const flowSpawns = FLOW_STORY_MAP.floors[0]!.spawnPoints.map((s) => s.id);
    expect(flowSpawns).toContain(up!.target.spawnPointId);

    const down = portalsOf(FLOW_STORY_MAP).find((p) => p.target.mapId === OFFICE_MAP.id);
    expect(down).toBeDefined();
    const officeSpawns = OFFICE_MAP.floors[0]!.spawnPoints.map((s) => s.id);
    expect(officeSpawns).toContain(down!.target.spawnPointId);
  });

  it("está no catálogo de mapas e tem elenco próprio (Flow e Story), sem a Equipe Digital", async () => {
    const map = await new OfficeMapProvider().getMap(FLOW_STORY_MAP_ID);
    expect(map.name).toBe("Flow Story — 1º andar");

    const actors = await new OfficeEntityProvider().listActors(FLOW_STORY_MAP_ID);
    expect(actors.map((a) => a.id)).toEqual(["flow", "story"]);
    expect(actors.map((a) => a.name)).toEqual(["Robô de Ofertas — Flow", "Escritora — Story"]);
    for (const actor of actors) {
      expect(actor.homeTile?.floorId).toBe("flow-story");
    }
  });
});
