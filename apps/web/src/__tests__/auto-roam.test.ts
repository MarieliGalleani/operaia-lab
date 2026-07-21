import { describe, expect, it } from "vitest";

import { TypedEventBus } from "@/modules/virtual-world/core/event-bus";
import { EcsWorld } from "@/modules/virtual-world/core/ecs/ecs-world";
import { SimulationClock } from "@/modules/virtual-world/core/clock/simulation-clock";
import { AutoRoamSystem } from "@/modules/virtual-world/core/systems/auto-roam-system";
import { MovementSystem } from "@/modules/virtual-world/core/systems/movement-system";
import type { SystemContext } from "@/modules/virtual-world/contracts/systems";

function makeContext(world: EcsWorld, bus: TypedEventBus, deltaMs: number): SystemContext {
  const clock = new SimulationClock(bus);
  return { world, bus, clock, deltaMs, time: clock.now() };
}

function spawnNpc(world: EcsWorld, actorId: string, col: number, row: number, local = false): number {
  return world.spawn({
    presence: { actorId, displayName: actorId, kind: "agent", local },
    transform: { col, row, floorId: "g", facing: "s" },
    movable: { speedTilesPerSec: 3, path: [], moving: false },
  });
}

describe("AutoRoamSystem — NPCs andam e param (trabalhando)", () => {
  it("após o tempo de espera, comanda um movimento dentro do raio", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = spawnNpc(world, "npc", 5, 5);
    const roam = new AutoRoamSystem({ minDwellMs: 1000, maxDwellMs: 1000, radiusTiles: 2, rng: () => 0.5 });
    roam.setGridSize(12, 12);

    // Inicializa e ainda não moveu (espera de 1000ms).
    roam.update(makeContext(world, bus, 0));
    expect(world.get(id, "movable")!.moving).toBe(false);

    // Passado o dwell, deve começar a caminhar para um tile próximo.
    roam.update(makeContext(world, bus, 1200));
    const movable = world.get(id, "movable")!;
    expect(movable.moving).toBe(true);
    expect(movable.target).toBeDefined();
    const target = movable.target!;
    expect(Math.abs(target.col - 5)).toBeLessThanOrEqual(2);
    expect(Math.abs(target.row - 5)).toBeLessThanOrEqual(2);
  });

  it("mantém os destinos dentro dos limites da grade", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = spawnNpc(world, "corner", 0, 0);
    // rng=0 -> deslocamento -radius (empurraria para fora); deve travar em 0.
    const roam = new AutoRoamSystem({ minDwellMs: 0, maxDwellMs: 0, radiusTiles: 3, rng: () => 0 });
    roam.setGridSize(10, 10);

    roam.update(makeContext(world, bus, 1));
    roam.update(makeContext(world, bus, 1));
    const target = world.get(id, "movable")!.target!;
    expect(target.col).toBeGreaterThanOrEqual(0);
    expect(target.row).toBeGreaterThanOrEqual(0);
  });

  it("não mexe no actor local (presence.local = true)", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const local = spawnNpc(world, "me", 4, 4, true);
    const roam = new AutoRoamSystem({ minDwellMs: 0, maxDwellMs: 0, rng: () => 0.5 });
    roam.setGridSize(12, 12);

    roam.update(makeContext(world, bus, 100));
    roam.update(makeContext(world, bus, 100));
    expect(world.get(local, "movable")!.moving).toBe(false);
    expect(world.get(local, "movable")!.target).toBeUndefined();
  });

  it("volta a caminhar após chegar (ciclo andar → trabalhar → andar)", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = spawnNpc(world, "loop", 5, 5);
    const roam = new AutoRoamSystem({ minDwellMs: 0, maxDwellMs: 0, radiusTiles: 1, rng: () => 0.9 });
    roam.setGridSize(12, 12);
    const move = new MovementSystem();

    roam.update(makeContext(world, bus, 10)); // inicia dwell (0ms) → já comanda
    expect(world.get(id, "movable")!.moving).toBe(true);

    // Anda até chegar.
    for (let i = 0; i < 10 && world.get(id, "movable")!.moving; i += 1) {
      move.update(makeContext(world, bus, 500));
    }
    expect(world.get(id, "movable")!.moving).toBe(false);

    // Recomeça o ciclo: 1º update detecta a chegada (vira "dwell"), 2º recomanda.
    roam.update(makeContext(world, bus, 10));
    roam.update(makeContext(world, bus, 10));
    expect(world.get(id, "movable")!.moving).toBe(true);
  });

  it("quando ocioso (AVAILABLE), pode caminhar até zona de descanso", () => {
    const world = new EcsWorld();
    const bus = new TypedEventBus();
    const id = world.spawn({
      presence: { actorId: "idle-npc", displayName: "Idle", kind: "agent", local: false },
      transform: { col: 2, row: 2, floorId: "g", facing: "s" },
      movable: { speedTilesPerSec: 3, path: [], moving: false },
      state: { current: "AVAILABLE" },
    });
    // rng: dwell + restChance + zoneIndex + col + row
    let calls = 0;
    const values = [0.5, 0.1, 0, 0.5, 0.5];
    const roam = new AutoRoamSystem({
      minDwellMs: 0,
      maxDwellMs: 0,
      restChance: 1,
      rng: () => values[calls++] ?? 0.5,
    });
    roam.setGridSize(20, 20);
    roam.setRestZones([{ bounds: { col: 10, row: 10, w: 4, h: 4 }, floorId: "g" }]);

    roam.update(makeContext(world, bus, 1));
    const target = world.get(id, "movable")!.target!;
    expect(target.col).toBeGreaterThanOrEqual(10);
    expect(target.col).toBeLessThan(14);
    expect(target.row).toBeGreaterThanOrEqual(10);
    expect(target.row).toBeLessThan(14);
  });
});
