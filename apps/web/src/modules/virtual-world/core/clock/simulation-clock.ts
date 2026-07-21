/**
 * Relogio simulado do mundo.
 *
 * O loop (Fase 1) chama `advance`; aqui o core fica testavel e deterministico.
 */

import type { WorldClock, WorldTime } from "../../contracts/clock";
import type { EventBus } from "../../contracts/events";

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_SIM_MINUTE = 1000;

export interface SimulationClockOptions {
  readonly scale?: number;
  readonly startHour?: number;
}

export class SimulationClock implements WorldClock {
  private totalMs: number;
  private scale: number;
  private running = false;

  constructor(
    private readonly bus: EventBus,
    options: SimulationClockOptions = {},
  ) {
    this.scale = options.scale ?? 1;
    const startHour = options.startHour ?? 9;
    this.totalMs = startHour * 60 * MS_PER_SIM_MINUTE;
  }

  now(): WorldTime {
    return this.toWorldTime(this.totalMs);
  }

  isRunning(): boolean {
    return this.running;
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  setScale(scale: number): void {
    this.scale = Math.max(0, scale);
  }

  getScale(): number {
    return this.scale;
  }

  advance(realDeltaMs: number): void {
    if (!this.running || realDeltaMs <= 0) {
      return;
    }
    const simDelta = realDeltaMs * this.scale;
    this.totalMs += simDelta;
    this.bus.emit("clock:tick", { time: this.now(), deltaMs: simDelta });
  }

  reset(time?: Partial<WorldTime>): void {
    const hour = time?.hour ?? 9;
    const minute = time?.minute ?? 0;
    const day = time?.day ?? 0;
    this.totalMs =
      time?.totalMs ?? (day * MINUTES_PER_DAY + hour * 60 + minute) * MS_PER_SIM_MINUTE;
  }

  private toWorldTime(totalMs: number): WorldTime {
    const totalMinutes = Math.floor(totalMs / MS_PER_SIM_MINUTE);
    const day = Math.floor(totalMinutes / MINUTES_PER_DAY);
    const minuteOfDay = totalMinutes % MINUTES_PER_DAY;
    return {
      totalMs,
      day,
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
    };
  }
}
