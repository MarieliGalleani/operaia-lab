import { describe, expect, it, vi } from "vitest";

import { TypedEventBus } from "@/modules/virtual-world/core/event-bus";
import { EcsWorld } from "@/modules/virtual-world/core/ecs/ecs-world";
import { SimulationClock } from "@/modules/virtual-world/core/clock/simulation-clock";
import { PortalSystem } from "@/modules/virtual-world/core/systems/portal-system";
import { createWorldRuntime } from "@/modules/virtual-world/core/create-world-runtime";
import { MemoryStateStore } from "@/modules/virtual-world/core/state/state-store";
import { NullWorldEngine } from "@/modules/virtual-world/engines/null-world-engine";
import { MockPresenceProvider } from "@/modules/virtual-world/providers/mock/mock-presence-provider";
import type { MapManifest } from "@/modules/virtual-world/contracts/map";
import type { WorldDataProvider } from "@/modules/virtual-world/contracts/providers";
import type { SystemContext } from "@/modules/virtual-world/contracts/systems";

const fakeContainer = {} as unknown as HTMLElement;

const MAP_A: MapManifest = {
  id: "office-main",
  name: "Office Main",
  themeId: "t",
  tileWidth: 64,
  tileHeight: 32,
  floors: [
    {
      id: "g",
      name: "G",
      level: 0,
      size: { cols: 8, rows: 8 },
      areas: [],
      entities: [
        {
          ref: "portal",
          components: {
            transform: { col: 3, row: 3 },
            portal: {
              portalId: "p-tech",
              target: { mapId: "technology-floor", spawnPointId: "in" },
              mode: "walk",
            },
            interactable: { kind: "portal", radiusTiles: 1, enabled: true },
          },
        },
        {
          ref: "portal",
          components: {
            transform: { col: 2, row: 2 },
            portal: {
              portalId: "p-secret",
              target: { mapId: "office-main", spawnPointId: "secret-room" },
              mode: "walk",
            },
          },
        },
        {
          ref: "portal",
          components: {
            transform: { col: 4, row: 4 },
            portal: {
              portalId: "p-bad",
              target: { mapId: "technology-floor", spawnPointId: "does-not-exist" },
              mode: "walk",
            },
          },
        },
      ],
      spawnPoints: [
        { id: "in", col: 1, row: 1 },
        { id: "secret-room", col: 7, row: 7 },
      ],
    },
  ],
  defaultSpawn: { floorId: "g", spawnPointId: "in" },
};

const MAP_B: MapManifest = {
  id: "technology-floor",
  name: "Technology Floor",
  themeId: "t",
  tileWidth: 64,
  tileHeight: 32,
  floors: [
    {
      id: "g",
      name: "G",
      level: 0,
      size: { cols: 8, rows: 8 },
      areas: [],
      entities: [],
      spawnPoints: [{ id: "in", col: 6, row: 6 }],
    },
  ],
  defaultSpawn: { floorId: "g", spawnPointId: "in" },
};

function makeProvider(): WorldDataProvider {
  const catalog: Record<string, MapManifest> = { "office-main": MAP_A, "technology-floor": MAP_B };
  return {
    kind: "test",
    maps: {
      async getMap(mapId) {
        const m = catalog[mapId];
        if (!m) {
          throw new Error(`unknown map ${mapId}`);
        }
        return m;
      },
      async listMaps() {
        return Object.values(catalog).map((m) => ({ id: m.id, name: m.name, themeId: m.themeId }));
      },
    },
    entities: { async listActors() { return []; } },
    assets: { async getManifest() { return { id: "t", spritesheets: [], tilesets: [] }; } },
    presence: new MockPresenceProvider(),
  };
}

describe("PortalSystem — emite portal:entered na entrada", () => {
  function makeContext(world: EcsWorld, bus: TypedEventBus): SystemContext {
    const clock = new SimulationClock(bus);
    return { world, bus, clock, deltaMs: 16, time: clock.now() };
  }

  it("emite só na transição fora→dentro (debounce) e ao reentrar", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    world.spawn({
      transform: { col: 2, row: 2, floorId: "g", facing: "s" },
      portal: { portalId: "p1", target: { mapId: "mapB", spawnPointId: "in" }, mode: "walk" },
    });
    const actor = world.spawn({
      presence: { actorId: "u", displayName: "U", kind: "user", local: true },
      transform: { col: 2, row: 2, floorId: "g", facing: "s" },
    });

    const events: string[] = [];
    bus.on("portal:entered", (p) => events.push(`${p.actorId}->${p.targetMapId}:${p.targetSpawnId}`));

    const system = new PortalSystem();
    system.update(makeContext(world, bus)); // entra
    system.update(makeContext(world, bus)); // permanece (sem novo emit)
    expect(events).toEqual(["u->mapB:in"]);

    // sai do portal e volta → novo emit
    world.get(actor, "transform")!.col = 5;
    system.update(makeContext(world, bus));
    world.get(actor, "transform")!.col = 2;
    system.update(makeContext(world, bus));
    expect(events).toHaveLength(2);
  });
});

describe("Portal — LocalActor troca o mapa e é reposicionado no spawnPoint", () => {
  it("office-main → portal → technology-floor com spawn correto", async () => {
    const runtime = createWorldRuntime({
      scopeId: "s",
      initialMapId: "office-main",
      data: makeProvider(),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });

    const entered = vi.fn();
    const mapEntered = vi.fn();
    runtime.bus.on("portal:entered", entered);
    runtime.bus.on("map:entered", mapEntered);

    await runtime.start(fakeContainer);
    expect(runtime.currentMapId).toBe("office-main");
    // LocalActor nasce no spawn de office-main
    expect(runtime.getLocalActorTile()).toEqual({ col: 1, row: 1, floorId: "g" });

    // o LOCAL actor entra no tile do portal (3,3)
    const localTransform = runtime.world.get(runtime.localActorId!, "transform")!;
    localTransform.col = 3;
    localTransform.row = 3;
    runtime.scheduler.run(16);

    await vi.waitFor(() => expect(runtime.currentMapId).toBe("technology-floor"));
    expect(entered).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "local-user",
        portalId: "p-tech",
        targetMapId: "technology-floor",
        targetSpawnId: "in",
      }),
    );
    // reposicionado no spawnPoint "in" do mapa de destino (6,6)
    expect(runtime.getLocalActorTile()).toEqual({ col: 6, row: 6, floorId: "g" });
    // evento de alto nível de chegada ao mapa de destino
    expect(mapEntered).toHaveBeenCalledWith({
      actorId: "local-user",
      mapId: "technology-floor",
      spawnId: "in",
    });

    runtime.dispose();
  });

  it("portal dentro do MESMO mapa teleporta sem recarregar (transform muda)", async () => {
    const runtime = createWorldRuntime({
      scopeId: "s",
      initialMapId: "office-main",
      data: makeProvider(),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });

    const mapChanged = vi.fn();
    const mapEntered = vi.fn();
    runtime.bus.on("map:changed", mapChanged);
    runtime.bus.on("map:entered", mapEntered);

    await runtime.start(fakeContainer);
    const idBefore = runtime.localActorId;

    // entra no portal interno p-secret (2,2) → office-main/secret-room
    const localTransform = runtime.world.get(runtime.localActorId!, "transform")!;
    localTransform.col = 2;
    localTransform.row = 2;
    runtime.scheduler.run(16);

    // mapa permanece igual; nenhum recarregamento (mesma entidade do actor)
    expect(runtime.currentMapId).toBe("office-main");
    expect(runtime.localActorId).toBe(idBefore);
    expect(mapChanged).not.toHaveBeenCalled();
    // transform reposicionado no spawn destino (7,7)
    expect(runtime.getLocalActorTile()).toEqual({ col: 7, row: 7, floorId: "g" });
    // chegada de alto nível emitida com o spawn interno
    expect(mapEntered).toHaveBeenLastCalledWith({
      actorId: "local-user",
      mapId: "office-main",
      spawnId: "secret-room",
    });

    runtime.dispose();
  });

  it("spawn inexistente cai no defaultSpawn e avisa em desenvolvimento", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runtime = createWorldRuntime({
      scopeId: "s",
      initialMapId: "office-main",
      data: makeProvider(),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });

    await runtime.start(fakeContainer);

    // portal p-bad (4,4) aponta para technology-floor/does-not-exist
    const localTransform = runtime.world.get(runtime.localActorId!, "transform")!;
    localTransform.col = 4;
    localTransform.row = 4;
    runtime.scheduler.run(16);

    await vi.waitFor(() => expect(runtime.currentMapId).toBe("technology-floor"));
    // fallback: defaultSpawn "in" (6,6) do mapa de destino
    expect(runtime.getLocalActorTile()).toEqual({ col: 6, row: 6, floorId: "g" });
    expect(warn).toHaveBeenCalledWith(
      "SpawnPoint does-not-exist não encontrado no mapa technology-floor. Usando defaultSpawn.",
    );

    warn.mockRestore();
    runtime.dispose();
  });

  it("NPC (não-local) entra no portal mas NÃO troca a visão global", async () => {
    const runtime = createWorldRuntime({
      scopeId: "s",
      initialMapId: "office-main",
      data: makeProvider(),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });

    const entered = vi.fn();
    runtime.bus.on("portal:entered", entered);

    await runtime.start(fakeContainer);

    // um NPC entra exatamente no tile do portal (3,3)
    runtime.world.spawn({
      presence: { actorId: "npc-1", displayName: "NPC", kind: "agent", local: false },
      transform: { col: 3, row: 3, floorId: "g", facing: "s" },
      renderable: { spriteId: "a", layer: "actors", visible: true },
    });

    runtime.scheduler.run(16);
    runtime.scheduler.run(16);

    // o evento genérico é emitido para o NPC…
    expect(entered).toHaveBeenCalledWith(expect.objectContaining({ actorId: "npc-1" }));
    // …mas a visão global permanece no mapa atual
    expect(runtime.currentMapId).toBe("office-main");

    runtime.dispose();
  });
});
