/**
 * Configuracao Assisted Execution (ADR-007 / Unified Mission Gateway).
 * Centraliza a feature flag — sem leitura de env neste modulo.
 *
 * Produto: `env.ASSISTED_QUEUE_MODE` (default true) via product-lab-runtime.
 * Default deste modulo permanece false para testes/lab isolados sem fila.
 * Kill-switch de produto: ASSISTED_QUEUE_MODE=false.
 */
export interface AssistedExecutionConfig {
  /**
   * Quando true, OperationalMissionService.run usa MissionQueue + projector.
   */
  readonly preferQueue: boolean;
}

export const DEFAULT_ASSISTED_EXECUTION_CONFIG: AssistedExecutionConfig = {
  preferQueue: false,
};

export function resolveAssistedExecutionConfig(
  partial?: Partial<AssistedExecutionConfig>,
): AssistedExecutionConfig {
  return {
    preferQueue:
      partial?.preferQueue ?? DEFAULT_ASSISTED_EXECUTION_CONFIG.preferQueue,
  };
}
