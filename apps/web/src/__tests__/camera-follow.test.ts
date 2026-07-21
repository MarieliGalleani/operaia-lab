import { describe, expect, it } from "vitest";

import { LogicalCamera } from "@/modules/virtual-world/core/camera/logical-camera";
import { SimulationClock } from "@/modules/virtual-world/core/clock/simulation-clock";
import { createWorldRuntime } from "@/modules/virtual-world/core/create-world-runtime";
import { EcsWorld } from "@/modules/virtual-world/core/ecs/ecs-world";
import { TypedEventBus } from "@/modules/virtual-world/core/event-bus";
import { tileToWorld } from "@/modules/virtual-world/core/geometry/iso";
import { MemoryStateStore } from "@/modules/virtual-world/core/state/state-store";
import { CameraFollowSystem } from "@/modules/virtual-world/core/systems/camera-follow-system";
import { NullWorldEngine } from "@/modules/virtual-world/engines/null-world-engine";
import { MockPresenceProvider } from "@/modules/virtual-world/providers/mock/mock-presence-provider";
import type { MapManifest } from "@/modules/virtual-world/contracts/map";
import type { WorldDataProvider } from "@/modules/virtual-world/contracts/providers";
import type { SystemContext } from "@/modules/virtual-world/contracts/systems";

const TILE_W = 64;
const TILE_H = 32;

function makeContext(world: EcsWorld, bus: TypedEventBus, deltaMs: number): SystemContext {
  const clock = new SimulationClock(bus);
  return { world, bus, clock, deltaMs, time: clock.now() };
}

function spawnTarget(world: EcsWorld, col: number, row: number): number {
  return world.spawn({
    presence: { actorId: "local-user", displayName: "Voce", kind: "user", local: true },
    transform: { col, row, floorId: "g", facing: "s" },
  });
}

describe("CameraFollowSystem — câmera acompanha a entidade alvo", () => {
  it("snapToTarget centraliza imediatamente no alvo", () => {
    const bus = new TypedEventBus();
    const camera = new LogicalCamera(bus);
    const world = new EcsWorld();
    const id = spawnTarget(world, 4, 4);

    const follow = new CameraFollowSystem(camera);
    follow.setTileSize(TILE_W, TILE_H);
    follow.setTarget(id);
    follow.snapToTarget(world);

    expect(camera.getState()).toMatchObject(tileToWorld(4, 4, TILE_W, TILE_H));
  });

  it("dentro da dead zone, a câmera não se move (evita luta)", () => {
    const bus = new TypedEventBus();
    const camera = new LogicalCamera(bus);
    const world = new EcsWorld();
    const id = spawnTarget(world, 1, 0); // ~32px de distância em mundo

    const follow = new CameraFollowSystem(camera, { smoothing: 20, deadZonePx: 80 });
    follow.setTileSize(TILE_W, TILE_H);
    follow.setTarget(id);
    follow.snapToTarget(world);
    const before = { ...camera.getState() };

    // Move o alvo um pouco (ainda dentro da dead zone).
    world.get(id, "transform")!.col = 1.2;
    follow.update(makeContext(world, bus, 500));

    expect(camera.getState().x).toBeCloseTo(before.x, 5);
    expect(camera.getState().y).toBeCloseTo(before.y, 5);
  });

  it("fora da dead zone, interpola em direção ao alvo (não salta de uma vez)", () => {
    const bus = new TypedEventBus();
    const camera = new LogicalCamera(bus);
    const world = new EcsWorld();
    const id = spawnTarget(world, 4, 4);
    const target = tileToWorld(4, 4, TILE_W, TILE_H);

    const follow = new CameraFollowSystem(camera, { smoothing: 8, deadZonePx: 0 });
    follow.setTileSize(TILE_W, TILE_H);
    follow.setTarget(id);

    follow.update(makeContext(world, bus, 125)); // dt=0.125 → fator ~0.632

    const state = camera.getState();
    expect(state.y).toBeGreaterThan(0);
    expect(state.y).toBeLessThan(target.y);
    expect(state.y).toBeCloseTo(target.y * (1 - Math.exp(-1)), 3);
  });

  it("converge para o alvo após vários frames", () => {
    const bus = new TypedEventBus();
    const camera = new LogicalCamera(bus);
    const world = new EcsWorld();
    const id = spawnTarget(world, 6, 2);
    const target = tileToWorld(6, 2, TILE_W, TILE_H);

    const follow = new CameraFollowSystem(camera, { deadZonePx: 0 });
    follow.setTileSize(TILE_W, TILE_H);
    follow.setTarget(id);
    for (let i = 0; i < 40; i += 1) {
      follow.update(makeContext(world, bus, 100));
    }

    expect(camera.getState().x).toBeCloseTo(target.x, 2);
    expect(camera.getState().y).toBeCloseTo(target.y, 2);
  });

  it("sem alvo definido, a câmera não se move", () => {
    const bus = new TypedEventBus();
    const camera = new LogicalCamera(bus);
    const world = new EcsWorld();
    spawnTarget(world, 4, 4);

    const follow = new CameraFollowSystem(camera);
    follow.setTileSize(TILE_W, TILE_H);
    follow.update(makeContext(world, bus, 1000));

    expect(camera.getState()).toMatchObject({ x: 0, y: 0 });
  });

  it("respeita os limites da câmera (limites do mapa)", () => {
    const bus = new TypedEventBus();
    const camera = new LogicalCamera(bus);
    camera.setBounds({ x: -100, y: 0, width: 200, height: 100 });
    const world = new EcsWorld();
    const id = spawnTarget(world, 4, 4); // y do alvo = 144 (> limite 100)

    const follow = new CameraFollowSystem(camera);
    follow.setTileSize(TILE_W, TILE_H);
    follow.setTarget(id);
    follow.snapToTarget(world);

    expect(camera.getState().y).toBe(100);
  });
});

const MAP: MapManifest = {
  id: "sandbox",
  name: "Sandbox",
  themeId: "t",
  tileWidth: TILE_W,
  tileHeight: TILE_H,
  floors: [
    {
      id: "g",
      name: "G",
      level: 0,
      size: { cols: 12, rows: 12 },
      areas: [],
      entities: [],
      spawnPoints: [{ id: "in", col: 1, row: 1 }],
    },
  ],
  defaultSpawn: { floorId: "g", spawnPointId: "in" },
};

function makeProvider(): WorldDataProvider {
  return {
    kind: "test",
    maps: {
      async getMap() {
        return MAP;
      },
      async listMaps() {
        return [{ id: MAP.id, name: MAP.name, themeId: MAP.themeId }];
      },
    },
    entities: { async listActors() { return []; } },
    assets: { async getManifest() { return { id: "t", spritesheets: [], tilesets: [] }; } },
    presence: new MockPresenceProvider(),
  };
}

describe("Runtime — o mundo acompanha o avatar", () => {
  it("ao mover o actor local, a câmera segue", async () => {
    const runtime = createWorldRuntime({
      scopeId: "operaia",
      initialMapId: "sandbox",
      data: makeProvider(),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });

    await runtime.start({} as unknown as HTMLElement);

    // câmera nasce centralizada no spawn (1,1)
    expect(runtime.camera.getState()).toMatchObject(tileToWorld(1, 1, TILE_W, TILE_H));

    runtime.moveLocalActorTo({ col: 6, row: 6, floorId: "g" });
    for (let i = 0; i < 40; i += 1) {
      runtime.scheduler.run(100);
    }

    const target = tileToWorld(6, 6, TILE_W, TILE_H);
    expect(runtime.getLocalActorTile()).toEqual({ col: 6, row: 6, floorId: "g" });
    // Com dead zone, a câmera pode parar a ~28px do alvo — ainda "segue".
    const cam = runtime.camera.getState();
    const dist = Math.hypot(cam.x - target.x, cam.y - target.y);
    expect(dist).toBeLessThanOrEqual(32);

    runtime.dispose();
  });
});
