import { describe, expect, it } from "vitest";

import { TypedEventBus } from "@/modules/virtual-world/core/event-bus";
import { EcsWorld } from "@/modules/virtual-world/core/ecs/ecs-world";
import { SimulationClock } from "@/modules/virtual-world/core/clock/simulation-clock";
import { spawnActorsIntoWorld } from "@/modules/virtual-world/core/actor-loader";
import { MovementSystem, commandMove } from "@/modules/virtual-world/core/systems/movement-system";
import type { MapManifest } from "@/modules/virtual-world/contracts/map";
import type { ActorDescriptor } from "@/modules/virtual-world/contracts/providers";
import type { SystemContext } from "@/modules/virtual-world/contracts/systems";

const MANIFEST: MapManifest = {
  id: "m1",
  name: "M1",
  themeId: "t",
  tileWidth: 64,
  tileHeight: 32,
  floors: [
    {
      id: "g",
      name: "G",
      level: 0,
      size: { cols: 12, rows: 12 },
      areas: [],
      entities: [],
      spawnPoints: [
        { id: "a", col: 2, row: 3 },
        { id: "b", col: 5, row: 6 },
      ],
    },
  ],
  defaultSpawn: { floorId: "g", spawnPointId: "a" },
};

const ACTORS: readonly ActorDescriptor[] = [
  { id: "x", name: "X", kind: "agent", spawnPointId: "b", stateId: "IDLE", spriteId: "s" },
  { id: "y", name: "Y", kind: "guest", homeTile: { col: 8, row: 1, floorId: "g" }, stateId: "IDLE" },
  { id: "z", name: "Z", kind: "user", stateId: "IDLE" },
];

describe("Actor loader — posição inicial via MapManifest", () => {
  it("spawna atores genéricos com componentes id/position/sprite/state", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const result = spawnActorsIntoWorld(world, ACTORS, MANIFEST, bus);

    expect(result.spawned).toBe(3);
    const ids = world.query("presence", "transform", "renderable", "state", "movable");
    expect(ids.length).toBe(3);
  });

  it("resolve a posição pelo spawn point do manifest, homeTile e defaultSpawn", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    spawnActorsIntoWorld(world, ACTORS, MANIFEST, bus);

    const byActor = (actorId: string) => {
      const id = world
        .query("presence", "transform")
        .find((e) => world.get(e, "presence")?.actorId === actorId)!;
      const t = world.get(id, "transform")!;
      return { col: t.col, row: t.row, floorId: t.floorId };
    };

    expect(byActor("x")).toEqual({ col: 5, row: 6, floorId: "g" }); // spawnPoint "b"
    expect(byActor("y")).toEqual({ col: 8, row: 1, floorId: "g" }); // homeTile
    expect(byActor("z")).toEqual({ col: 2, row: 3, floorId: "g" }); // defaultSpawn "a"
  });
});

describe("MovementSystem — movimentação simples e genérica", () => {
  function makeContext(world: EcsWorld, bus: TypedEventBus, deltaMs: number): SystemContext {
    const clock = new SimulationClock(bus);
    return { world, bus, clock, deltaMs, time: clock.now() };
  }

  it("avança a posição em direção ao alvo e chega ao destino", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = world.spawn({
      presence: { actorId: "x", displayName: "X", kind: "agent", local: false },
      transform: { col: 0, row: 0, floorId: "g", facing: "s" },
      movable: { speedTilesPerSec: 5, path: [], moving: false },
    });

    const moved: { actorId: string; to: { col: number; row: number } }[] = [];
    bus.on("actor:moved", (p) => moved.push({ actorId: p.actorId, to: { col: p.to.col, row: p.to.row } }));

    commandMove(world, id, { col: 3, row: 4 }); // distância 5
    const system = new MovementSystem();
    system.update(makeContext(world, bus, 1000)); // passo 5 → chega

    const t = world.get(id, "transform")!;
    expect(t.col).toBe(3);
    expect(t.row).toBe(4);
    expect(world.get(id, "movable")!.moving).toBe(false);
    expect(moved).toEqual([{ actorId: "x", to: { col: 3, row: 4 } }]);
  });

  it("move parcialmente quando o passo é menor que a distância", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = world.spawn({
      transform: { col: 0, row: 0, floorId: "g", facing: "s" },
      movable: { speedTilesPerSec: 1, path: [], moving: false },
    });

    commandMove(world, id, { col: 3, row: 4 });
    new MovementSystem().update(makeContext(world, bus, 1000)); // passo 1 de 5

    const t = world.get(id, "transform")!;
    expect(t.col).toBeCloseTo(0.6, 5);
    expect(t.row).toBeCloseTo(0.8, 5);
    expect(world.get(id, "movable")!.moving).toBe(true);
  });

  it("ignora entidades sem alvo/moving", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = world.spawn({
      transform: { col: 1, row: 1, floorId: "g", facing: "s" },
      movable: { speedTilesPerSec: 5, path: [], moving: false },
    });
    new MovementSystem().update(makeContext(world, bus, 1000));
    const t = world.get(id, "transform")!;
    expect(t).toMatchObject({ col: 1, row: 1 });
  });
});
