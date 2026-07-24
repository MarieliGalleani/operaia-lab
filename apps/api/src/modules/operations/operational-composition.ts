import {
  createLabRuntime,
  type LabRuntimeOptions,
  type OperationalRuntime,
} from "./lab-runtime.js";

export type { OperationalRuntime, LabRuntime } from "./lab-runtime.js";
export { createLabRuntime } from "./lab-runtime.js";

/**
 * Composition da operacao assistida (CLI / testes ops-only).
 * Delega ao Lab Runtime unificado — mesmo office/store/serviço.
 */
export function createOperationalRuntime(
  options: LabRuntimeOptions = {},
): OperationalRuntime {
  return createLabRuntime(options).operations;
}

/** Missao controlada canonica do primeiro ciclo NEXO. */
export const NEXO_OPERATIONAL_MISSION = {
  workspaceId: "nexo",
  objective:
    "Finalizar desenvolvimento da NEXO: priorizar autenticacao, " +
    "desbloquear sincronizacao offline e reportar proximas acoes executivas.",
} as const;
