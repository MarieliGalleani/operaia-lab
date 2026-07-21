import { describe, expect, it } from "vitest";

import { createWorldRuntime } from "@/modules/virtual-world/core/create-world-runtime";
import { MemoryStateStore } from "@/modules/virtual-world/core/state/state-store";
import { NullWorldEngine } from "@/modules/virtual-world/engines/null-world-engine";
import { MockPresenceProvider } from "@/modules/virtual-world/providers/mock/mock-presence-provider";
import type { MapManifest } from "@/modules/virtual-world/contracts/map";
import type { WorldDataProvider } from "@/modules/virtual-world/contracts/providers";

const fakeContainer = {} as unknown as HTMLElement;

const MAP: MapManifest = {
  id: "sandbox",
  name: "Sandbox",
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

function makeRuntime() {
  return createWorldRuntime({
    scopeId: "operaia",
    initialMapId: "sandbox",
    data: makeProvider(),
    engine: new NullWorldEngine(),
    stateStore: new MemoryStateStore(),
  });
}

describe("LocalActor — actor controlável do usuário conectado", () => {
  it("o actor local existe e é genérico (presence.local + transform + sprite + state)", async () => {
    const runtime = makeRuntime();
    await runtime.start(fakeContainer);

    expect(runtime.localActorId).toBeDefined();

    const id = runtime.localActorId!;
    const presence = runtime.world.get(id, "presence");
    expect(presence?.local).toBe(true);
    expect(presence?.actorId).toBe("local-user");
    expect(runtime.world.get(id, "transform")).toBeDefined();
    expect(runtime.world.get(id, "renderable")).toBeDefined();
    expect(runtime.world.get(id, "state")).toBeDefined();

    runtime.dispose();
    expect(runtime.localActorId).toBeUndefined();
  });

  it("a posição inicial vem do spawnPoint do MapManifest", async () => {
    const runtime = makeRuntime();
    await runtime.start(fakeContainer);

    expect(runtime.getLocalActorTile()).toEqual({ col: 1, row: 1, floorId: "g" });

    runtime.dispose();
  });

  it("o estado (posição do actor local) é persistido no runtime", async () => {
    const runtime = makeRuntime();
    await runtime.start(fakeContainer);

    // posição inicial (spawn) já persistida
    const initial = runtime.state.load("operaia");
    expect(initial?.avatarTile).toEqual({ col: 1, row: 1, floorId: "g" });

    // ao mover o actor local, a posição persistida acompanha
    runtime.moveLocalActorTo({ col: 4, row: 4, floorId: "g" });
    runtime.scheduler.run(1000);
    runtime.scheduler.run(1000);

    expect(runtime.getLocalActorTile()).toEqual({ col: 4, row: 4, floorId: "g" });
    expect(runtime.state.load("operaia")?.avatarTile).toEqual({ col: 4, row: 4, floorId: "g" });

    runtime.dispose();
  });
});
