import { describe, expect, it } from "vitest";

import { SimulationClock } from "@/modules/virtual-world/core/clock/simulation-clock";
import { EcsWorld } from "@/modules/virtual-world/core/ecs/ecs-world";
import { TypedEventBus } from "@/modules/virtual-world/core/event-bus";
import { KeyboardInput } from "@/modules/virtual-world/core/input/keyboard-input";
import type { DirectionalInput } from "@/modules/virtual-world/core/input/keyboard-input";
import { KeyboardMovementSystem } from "@/modules/virtual-world/core/systems/keyboard-movement-system";
import type { SystemContext } from "@/modules/virtual-world/contracts/systems";

function makeContext(world: EcsWorld, bus: TypedEventBus, deltaMs: number): SystemContext {
  const clock = new SimulationClock(bus);
  return { world, bus, clock, deltaMs, time: clock.now() };
}

function fixedInput(dx: number, dy: number): DirectionalInput {
  return { getDirection: () => ({ dx, dy }) };
}

describe("KeyboardInput — WASD + setas viram vetor de direção", () => {
  it("sem teclas → vetor zero", () => {
    expect(new KeyboardInput().getDirection()).toEqual({ dx: 0, dy: 0 });
  });

  it("direita → (1,0); cima → (0,-1)", () => {
    const input = new KeyboardInput();
    input.press("right");
    expect(input.getDirection()).toEqual({ dx: 1, dy: 0 });
    input.release("right");
    input.press("up");
    expect(input.getDirection()).toEqual({ dx: 0, dy: -1 });
  });

  it("teclas opostas se cancelam", () => {
    const input = new KeyboardInput();
    input.press("left");
    input.press("right");
    expect(input.getDirection()).toEqual({ dx: 0, dy: 0 });
  });

  it("diagonal é normalizada (magnitude 1)", () => {
    const input = new KeyboardInput();
    input.press("right");
    input.press("down");
    const { dx, dy } = input.getDirection();
    expect(Math.hypot(dx, dy)).toBeCloseTo(1, 5);
    expect(dx).toBeCloseTo(Math.SQRT1_2, 5);
    expect(dy).toBeCloseTo(Math.SQRT1_2, 5);
  });
});

describe("KeyboardMovementSystem — move o actor local por delta time", () => {
  function spawnLocal(world: EcsWorld) {
    return world.spawn({
      presence: { actorId: "local-user", displayName: "Voce", kind: "user", local: true },
      transform: { col: 5, row: 5, floorId: "g", facing: "s" },
      movable: { speedTilesPerSec: 4, path: [], moving: false },
    });
  }

  it("atualiza o TransformComponent proporcionalmente ao delta time", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = spawnLocal(world);

    new KeyboardMovementSystem(fixedInput(1, 0)).update(makeContext(world, bus, 500)); // 0,5s * 4 = 2 tiles

    const t = world.get(id, "transform")!;
    expect(t.col).toBeCloseTo(7, 5);
    expect(t.row).toBeCloseTo(5, 5);
    expect(t.facing).toBe("e");
  });

  it("o deslocamento escala com o delta time", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = spawnLocal(world);

    const system = new KeyboardMovementSystem(fixedInput(0, -1));
    system.update(makeContext(world, bus, 250)); // 1 tile
    system.update(makeContext(world, bus, 250)); // +1 tile

    const t = world.get(id, "transform")!;
    expect(t.row).toBeCloseTo(3, 5); // 5 - 2
    expect(t.facing).toBe("n");
  });

  it("emite entity:moved com from/to", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = spawnLocal(world);

    const moved: { entityId: number; from: number; to: number }[] = [];
    bus.on("entity:moved", (p) => moved.push({ entityId: p.entityId, from: p.from.col, to: p.to.col }));

    new KeyboardMovementSystem(fixedInput(1, 0)).update(makeContext(world, bus, 1000));

    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ entityId: id, from: 5 });
    expect(moved[0]!.to).toBeCloseTo(9, 5); // 5 + 4
  });

  it("não move quando não há direção", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = spawnLocal(world);
    const events: unknown[] = [];
    bus.on("entity:moved", (p) => events.push(p));

    new KeyboardMovementSystem(fixedInput(0, 0)).update(makeContext(world, bus, 1000));

    expect(world.get(id, "transform")).toMatchObject({ col: 5, row: 5 });
    expect(events).toHaveLength(0);
  });

  it("ignora entidades que não são o actor local", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const remote = world.spawn({
      presence: { actorId: "npc", displayName: "NPC", kind: "agent", local: false },
      transform: { col: 1, row: 1, floorId: "g", facing: "s" },
    });

    new KeyboardMovementSystem(fixedInput(1, 0)).update(makeContext(world, bus, 1000));

    expect(world.get(remote, "transform")).toMatchObject({ col: 1, row: 1 });
  });
});
