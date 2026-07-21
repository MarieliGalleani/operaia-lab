/**
 * AutoRoamSystem — dá "vida" a atores NÃO-locais (NPCs).
 *
 * Genérico: não sabe o que o ator representa. Alterna entre:
 *  - "dwell": parado (trabalhando no posto / descansando);
 *  - "walk": caminha até um destino (usa MovementSystem via `commandMove`).
 *
 * Destinos:
 *  - estado "ocioso" (lista configurável de state.current) → zona de descanso;
 *  - caso contrário → vagueia perto da origem (estação de trabalho).
 *
 * Só afeta `presence.local === false`. Sem regras de negócio acopladas.
 */

import type { EntityId, TileCoord, TileRect } from "../../contracts/ids";
import type { System, SystemContext } from "../../contracts/systems";
import { commandMove } from "./movement-system";

interface RoamState {
  originCol: number;
  originRow: number;
  mode: "dwell" | "walk";
  untilMs: number;
  /** Último destino foi zona de descanso? (próximo ciclo tende a voltar ao posto). */
  atRest: boolean;
}

export interface RestZone {
  readonly bounds: TileRect;
  readonly floorId: string;
}

export interface AutoRoamOptions {
  readonly minDwellMs?: number;
  readonly maxDwellMs?: number;
  readonly radiusTiles?: number;
  /** Chance (0..1) de ir a uma zona de descanso quando ocioso. */
  readonly restChance?: number;
  /** Valores de `state.current` tratados como ociosos (genérico). */
  readonly idleStates?: readonly string[];
  readonly rng?: () => number;
}

const DEFAULT_IDLE_STATES = ["IDLE", "AVAILABLE", "WAITING"] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class AutoRoamSystem implements System {
  readonly name = "auto-roam";

  private readonly states = new Map<EntityId, RoamState>();
  private elapsedMs = 0;
  private cols = Number.POSITIVE_INFINITY;
  private rows = Number.POSITIVE_INFINITY;
  private restZones: readonly RestZone[] = [];

  private readonly minDwellMs: number;
  private readonly maxDwellMs: number;
  private readonly radiusTiles: number;
  private readonly restChance: number;
  private readonly idleStates: ReadonlySet<string>;
  private readonly rng: () => number;

  constructor(options: AutoRoamOptions = {}) {
    this.minDwellMs = options.minDwellMs ?? 2500;
    this.maxDwellMs = options.maxDwellMs ?? 6000;
    this.radiusTiles = options.radiusTiles ?? 2;
    this.restChance = options.restChance ?? 0.45;
    this.idleStates = new Set(options.idleStates ?? DEFAULT_IDLE_STATES);
    this.rng = options.rng ?? Math.random;
  }

  setGridSize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  /** Zonas genéricas de descanso (ex.: lounge, games, cafeteria) — só dados. */
  setRestZones(zones: readonly RestZone[]): void {
    this.restZones = zones;
  }

  reset(): void {
    this.states.clear();
    this.elapsedMs = 0;
  }

  update({ world, deltaMs }: SystemContext): void {
    this.elapsedMs += deltaMs;
    const alive = new Set<EntityId>();

    for (const id of world.query("movable", "transform", "presence")) {
      const presence = world.get(id, "presence");
      if (!presence || presence.local) {
        continue;
      }
      const movable = world.get(id, "movable");
      const transform = world.get(id, "transform");
      if (!movable || !transform) {
        continue;
      }
      alive.add(id);

      let state = this.states.get(id);
      if (!state) {
        state = {
          originCol: transform.col,
          originRow: transform.row,
          mode: "dwell",
          untilMs: this.elapsedMs + this.randomDwell(),
          atRest: false,
        };
        this.states.set(id, state);
      }

      if (state.mode === "walk") {
        if (!movable.moving) {
          state.mode = "dwell";
          state.untilMs = this.elapsedMs + this.randomDwell();
        }
        continue;
      }

      if (this.elapsedMs >= state.untilMs) {
        const actorState = world.get(id, "state")?.current;
        const target = this.pickTarget(state, transform.floorId, actorState);
        commandMove(world, id, target);
        state.mode = "walk";
      }
    }

    for (const key of [...this.states.keys()]) {
      if (!alive.has(key)) {
        this.states.delete(key);
      }
    }
  }

  private randomDwell(): number {
    return this.minDwellMs + this.rng() * (this.maxDwellMs - this.minDwellMs);
  }

  private pickTarget(state: RoamState, floorId: string, actorState: string | undefined): TileCoord {
    // Volta ao posto após descanso, ou fica no posto se está "trabalhando".
    if (state.atRest) {
      state.atRest = false;
      return this.pickNear(state.originCol, state.originRow, floorId, this.radiusTiles);
    }

    const isIdle = actorState !== undefined && this.idleStates.has(actorState);
    if (isIdle && this.restZones.length > 0 && this.rng() < this.restChance) {
      const zone = this.restZones[Math.floor(this.rng() * this.restZones.length)]!;
      state.atRest = true;
      return this.pickInZone(zone);
    }

    return this.pickNear(state.originCol, state.originRow, floorId, this.radiusTiles);
  }

  private pickNear(originCol: number, originRow: number, floorId: string, radius: number): TileCoord {
    const col = clamp(Math.round(originCol + (this.rng() * 2 - 1) * radius), 0, this.cols - 1);
    const row = clamp(Math.round(originRow + (this.rng() * 2 - 1) * radius), 0, this.rows - 1);
    return { col, row, floorId };
  }

  private pickInZone(zone: RestZone): TileCoord {
    const { bounds, floorId } = zone;
    const col = clamp(
      Math.floor(bounds.col + this.rng() * Math.max(1, bounds.w)),
      0,
      this.cols - 1,
    );
    const row = clamp(
      Math.floor(bounds.row + this.rng() * Math.max(1, bounds.h)),
      0,
      this.rows - 1,
    );
    return { col, row, floorId };
  }
}
