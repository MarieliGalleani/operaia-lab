/**
 * Parametros configuraveis do loop. Plugavel: injete um objeto diferente
 * para mudar limites sem tocar no motor.
 */
export interface LoopPolicy {
  /** Numero maximo de ciclos antes de encerrar sem concluir. */
  readonly maxCycles: number;
  /** Tempo maximo total (ms). `null` = sem limite. */
  readonly maxDurationMs: number | null;
  /** Numero maximo de ciclos com falha. `null` = sem limite. */
  readonly maxFailures: number | null;
  /** Se true, cada novo ciclo apos o primeiro e um replanejamento. */
  readonly autoReplan: boolean;
}

export const defaultLoopPolicy: LoopPolicy = {
  maxCycles: 10,
  maxDurationMs: null,
  maxFailures: 3,
  autoReplan: true,
};
