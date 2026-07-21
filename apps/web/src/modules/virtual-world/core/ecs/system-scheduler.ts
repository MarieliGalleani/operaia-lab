/**
 * Agendador de sistemas do ECS.
 *
 * Monta o `SystemContext` e roda os sistemas na ordem de insercao. Sistemas
 * concretos chegam na Fase 1; aqui fica a infraestrutura de execucao.
 */

import type { WorldClock } from "../../contracts/clock";
import type { EntityWorld } from "../../contracts/entities";
import type { EventBus } from "../../contracts/events";
import type { System, SystemScheduler } from "../../contracts/systems";

export class DefaultSystemScheduler implements SystemScheduler {
  private readonly systems: System[] = [];

  constructor(
    private readonly world: EntityWorld,
    private readonly bus: EventBus,
    private readonly clock: WorldClock,
  ) {}

  add(system: System): void {
    if (this.has(system.name)) {
      throw new Error(`Sistema duplicado: ${system.name}`);
    }
    this.systems.push(system);
  }

  remove(name: string): void {
    const index = this.systems.findIndex((system) => system.name === name);
    if (index >= 0) {
      this.systems.splice(index, 1);
    }
  }

  has(name: string): boolean {
    return this.systems.some((system) => system.name === name);
  }

  run(deltaMs: number): void {
    const time = this.clock.now();
    for (const system of this.systems) {
      system.update({ world: this.world, bus: this.bus, clock: this.clock, deltaMs, time });
    }
  }

  list(): readonly string[] {
    return this.systems.map((system) => system.name);
  }
}
