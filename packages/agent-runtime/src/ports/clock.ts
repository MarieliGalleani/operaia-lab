/**
 * Fonte de tempo injetavel. Torna timing e logs deterministicos em teste
 * e evita acoplamento a Date.now() global.
 */
export interface Clock {
  now(): Date;
}

/** Implementacao padrao baseada no relogio do sistema. */
export const systemClock: Clock = {
  now: () => new Date(),
};
