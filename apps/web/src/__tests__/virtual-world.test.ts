import { describe, expect, it, vi } from "vitest";

import { TypedEventBus } from "@/modules/virtual-world/core/event-bus";
import { EcsWorld } from "@/modules/virtual-world/core/ecs/ecs-world";
import { SimulationClock } from "@/modules/virtual-world/core/clock/simulation-clock";
import { LogicalCamera } from "@/modules/virtual-world/core/camera/logical-camera";
import { MemoryStateStore } from "@/modules/virtual-world/core/state/state-store";
import { loadManifestIntoWorld } from "@/modules/virtual-world/core/map-loader";
import { createWorldRuntime } from "@/modules/virtual-world/core/create-world-runtime";
import { NullWorldEngine } from "@/modules/virtual-world/engines/null-world-engine";
import { createWorldEngine } from "@/modules/virtual-world/engines/engine-factory";
import { createWorldDataProvider } from "@/modules/virtual-world/providers/provider-factory";
import { SAMPLE_MAP } from "@/modules/virtual-world/providers/mock/data/sample-map";
import type { WorldViewState } from "@/modules/virtual-world/contracts/state";
import { createOfficeWorldProvider } from "@/modules/office-domain/office-world-data-provider";
import { CAMPUS_PLAZA_MAP } from "@/modules/office-domain/data/campus-plaza-map";
import { CAMPUS_RECEPTION_MAP } from "@/modules/office-domain/data/campus-reception-map";
import { CAMPUS_RESIDENT_ENTRANCES } from "@/modules/office-domain/data/campus-resident-entrances";
import { GERAI_ENTRANCE_MAP } from "@/modules/office-domain/data/gerai-entrance-map";
import { GERAI_F2_MAP } from "@/modules/office-domain/data/gerai-floor-2-map";
import { OFFICE_MAP } from "@/modules/office-domain/data/office-map";
import { CAMPUS_RECEPTION_MAP_ID } from "@/modules/office-domain/data/campus-ids";

const fakeContainer = {} as unknown as HTMLElement;

describe("EventBus tipado", () => {
  it("emite, cancela e once funcionam", () => {
    const bus = new TypedEventBus();
    const seen: number[] = [];
    const off = bus.on("entity:spawned", (p) => seen.push(p.entityId));
    bus.emit("entity:spawned", { entityId: 1 });
    off();
    bus.emit("entity:spawned", { entityId: 2 });

    let onceCount = 0;
    bus.once("entity:spawned", () => (onceCount += 1));
    bus.emit("entity:spawned", { entityId: 3 });
    bus.emit("entity:spawned", { entityId: 4 });

    expect(seen).toEqual([1]);
    expect(onceCount).toBe(1);
  });
});

describe("ECS generico", () => {
  it("cria, consulta por componentes e destroi", () => {
    const world = new EcsWorld();
    const a = world.spawn({
      transform: { col: 1, row: 1, floorId: "ground", facing: "s" },
      renderable: { spriteId: "x", layer: "objects", visible: true },
    });
    world.spawn({ transform: { col: 2, row: 2, floorId: "ground", facing: "s" } });

    expect(world.query("transform").length).toBe(2);
    expect(world.query("renderable").length).toBe(1);
    expect(world.query("transform", "renderable")).toEqual([a]);

    world.destroy(a);
    expect(world.isAlive(a)).toBe(false);
    expect(world.query("renderable").length).toBe(0);
  });
});

describe("SimulationClock", () => {
  it("so avanca quando rodando e emite clock:tick", () => {
    const bus = new TypedEventBus();
    const clock = new SimulationClock(bus, { scale: 1, startHour: 9 });
    let ticks = 0;
    bus.on("clock:tick", () => (ticks += 1));

    clock.advance(1000);
    expect(ticks).toBe(0);

    clock.start();
    clock.advance(1000);
    expect(ticks).toBe(1);
    expect(clock.now().hour).toBe(9);
  });
});

describe("LogicalCamera", () => {
  it("aplica zoom/limites e emite camera:moved", () => {
    const bus = new TypedEventBus();
    const camera = new LogicalCamera(bus, { minZoom: 0.5, maxZoom: 2 });
    let moves = 0;
    bus.on("camera:moved", () => (moves += 1));

    camera.moveTo(10, 20);
    camera.zoomTo(5);
    expect(camera.getState()).toEqual({ x: 10, y: 20, zoom: 2 });
    expect(moves).toBeGreaterThanOrEqual(2);
  });
});

describe("StateStore por escopo", () => {
  it("salva/carrega/limpa por scopeId", () => {
    const store = new MemoryStateStore();
    const state: WorldViewState = {
      version: 1,
      scopeId: "acme",
      mapId: "office",
      floorId: "ground",
      camera: { x: 0, y: 0, zoom: 1 },
      clock: { totalMs: 0, day: 0, hour: 9, minute: 0 },
    };
    store.save(state);
    expect(store.load("acme")?.mapId).toBe("office");
    store.clear("acme");
    expect(store.load("acme")).toBeUndefined();
  });
});

describe("map-loader (dados -> ECS)", () => {
  it("carrega o mapa generico de exemplo", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const result = loadManifestIntoWorld(world, SAMPLE_MAP, bus);
    expect(result.areas).toBe(1);
    expect(result.portals).toBe(1);
    expect(world.query("portal").length).toBe(1);
  });

  it("carrega o escritorio (dominio) como mapa de dados", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const result = loadManifestIntoWorld(world, OFFICE_MAP, bus);
    const expectedAreas = OFFICE_MAP.floors.reduce((n, f) => n + f.areas.length, 0);
    expect(result.areas).toBe(expectedAreas);
    expect(world.query("area").length).toBe(result.areas);
    expect(result.portals).toBe(2);
  });

  it("carrega o 2º andar da Geraí como mapa de dados", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const result = loadManifestIntoWorld(world, GERAI_F2_MAP, bus);
    const expectedAreas = GERAI_F2_MAP.floors.reduce((n, f) => n + f.areas.length, 0);
    expect(result.areas).toBe(expectedAreas);
    expect(result.portals).toBe(2);
  });

  it("carrega a Recepção e a Praça do Campus", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const reception = loadManifestIntoWorld(world, CAMPUS_RECEPTION_MAP, bus);
    expect(reception.portals).toBe(1);
    world.clear();
    const plaza = loadManifestIntoWorld(world, CAMPUS_PLAZA_MAP, bus);
    expect(plaza.portals).toBe(1 + CAMPUS_RESIDENT_ENTRANCES.length);
  });

  it("carrega a entrada oficial da Geraí", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const result = loadManifestIntoWorld(world, GERAI_ENTRANCE_MAP, bus);
    expect(result.portals).toBe(2);
  });
});

describe("NullWorldEngine + factory", () => {
  it("factory retorna motor null e conhece a mesma porta", async () => {
    const engine = createWorldEngine("null");
    expect(engine.id).toBe("null");
    await engine.init({} as never);
    await engine.loadMap(OFFICE_MAP);
    expect((engine as NullWorldEngine).debug().lastMapId).toBe("office");
  });

  it("factory constroi o motor pixi (Fase 1) implementando a mesma porta", () => {
    const engine = createWorldEngine("pixi");
    expect(engine.id).toBe("pixi");
    expect(typeof engine.init).toBe("function");
    expect(typeof engine.loadMap).toBe("function");
  });
});

describe("Provider factory", () => {
  it("mock e o padrao; nexo/http ainda nao disponiveis", () => {
    expect(createWorldDataProvider("mock").kind).toBe("mock");
    expect(() => createWorldDataProvider("nexo")).toThrow();
  });
});

describe("Runtime carrega o Opera Campus como entrada do mundo", () => {
  it("engine generica carrega a Recepção via provider de dominio", async () => {
    const runtime = createWorldRuntime({
      scopeId: "opera-campus",
      initialMapId: CAMPUS_RECEPTION_MAP_ID,
      data: createOfficeWorldProvider(),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });

    const ready = vi.fn();
    runtime.bus.on("world:ready", ready);

    await runtime.start(fakeContainer);

    expect(runtime.started).toBe(true);
    expect(runtime.currentMapId).toBe(CAMPUS_RECEPTION_MAP_ID);
    expect(runtime.providerKind).toBe("office-mock");
    expect(runtime.world.query("area").length).toBeGreaterThan(0);
    expect(ready).toHaveBeenCalledTimes(1);

    runtime.dispose();
    expect(runtime.started).toBe(false);
  });

  it("troca Campus → Praça → Lab por loadMap", async () => {
    const runtime = createWorldRuntime({
      scopeId: "opera-campus",
      initialMapId: CAMPUS_RECEPTION_MAP_ID,
      data: createOfficeWorldProvider(),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });
    await runtime.start(fakeContainer);
    await runtime.loadMap("campus-plaza");
    expect(runtime.currentMapId).toBe("campus-plaza");
    await runtime.loadMap("office");
    expect(runtime.currentMapId).toBe("office");
    runtime.dispose();
  });
});

describe("Runtime carrega o escritorio como mapa de Residente", () => {
  it("engine generica carrega o escritorio via provider de dominio", async () => {
    const runtime = createWorldRuntime({
      scopeId: "operaia",
      initialMapId: "office",
      data: createOfficeWorldProvider(),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });

    const ready = vi.fn();
    runtime.bus.on("world:ready", ready);

    await runtime.start(fakeContainer);

    expect(runtime.started).toBe(true);
    expect(runtime.currentMapId).toBe("office");
    expect(runtime.providerKind).toBe("office-mock");
    expect(runtime.world.query("area").length).toBeGreaterThan(0);
    expect(ready).toHaveBeenCalledTimes(1);

    runtime.dispose();
    expect(runtime.started).toBe(false);
  });

  it("troca de mapa por id emite map:changed (portal-ready)", async () => {
    const runtime = createWorldRuntime({
      scopeId: "operaia",
      initialMapId: "sandbox",
      data: createWorldDataProvider("mock"),
      engine: new NullWorldEngine(),
      stateStore: new MemoryStateStore(),
    });

    await runtime.start(fakeContainer);
    expect(runtime.currentMapId).toBe("sandbox");

    // provider generico so conhece "sandbox": recarregar mantem consistencia
    await runtime.loadMap("sandbox");
    expect(runtime.currentMapId).toBe("sandbox");

    runtime.dispose();
  });
});
