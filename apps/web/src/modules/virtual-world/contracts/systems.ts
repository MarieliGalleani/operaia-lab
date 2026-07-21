/**
 * SISTEMAS do ECS (contratos).
 *
 * Cada sistema encapsula um comportamento generico e roda sobre consultas de
 * componentes. Sistemas concretos chegam na Fase 1.
 */

import type { WorldClock, WorldTime } from "./clock";
import type { EntityWorld } from "./entities";
import type { EventBus } from "./events";

export interface SystemContext {
  readonly world: EntityWorld;
  readonly bus: EventBus;
  readonly clock: WorldClock;
  readonly deltaMs: number;
  readonly time: WorldTime;
}

export interface System {
  readonly name: string;
  update(context: SystemContext): void;
}

export interface SystemScheduler {
  add(system: System): void;
  remove(name: string): void;
  has(name: string): boolean;
  run(deltaMs: number): void;
  list(): readonly string[];
}
