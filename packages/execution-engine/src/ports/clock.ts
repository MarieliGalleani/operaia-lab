/**
 * Fonte de tempo injetavel — timing e logs deterministicos em teste.
 *
 * NOTA: contrato identico ao Clock de @operaia/agent-runtime. Uma melhoria
 * futura e consolidar este tipo em @operaia/shared e reusar nos dois pacotes.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
