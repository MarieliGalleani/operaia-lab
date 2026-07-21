/**
 * Contrato do relogio interno do mundo.
 *
 * Habilita futuramente: ciclos, eventos agendados, iluminacao dinamica e
 * agendas — em qualquer ambiente, nao so escritorio.
 */

export interface WorldTime {
  readonly totalMs: number;
  readonly day: number;
  /** Hora do dia 0-23. */
  readonly hour: number;
  /** Minuto 0-59. */
  readonly minute: number;
}

export interface WorldClock {
  now(): WorldTime;
  isRunning(): boolean;
  start(): void;
  stop(): void;
  /** ms simulados por ms real (aceleracao). */
  setScale(scale: number): void;
  getScale(): number;
  /** Avanca o tempo simulado (chamado pelo loop). Emite `clock:tick`. */
  advance(realDeltaMs: number): void;
  reset(time?: Partial<WorldTime>): void;
}
