/** Fonte de tempo injetavel — torna o loop deterministico em teste. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
