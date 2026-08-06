/**
 * Classificacao oficial de criticidade operacional (A.5.3).
 * Falha NON_CRITICAL nunca pode transformar missao SUCCESS em FAILED.
 */

export const OperationCriticality = {
  CRITICAL: "CRITICAL",
  NON_CRITICAL: "NON_CRITICAL",
} as const;

export type OperationCriticality =
  (typeof OperationCriticality)[keyof typeof OperationCriticality];

/** Operacoes que afetam estado terminal da missao / fila / execucao. */
export const CriticalOperation = {
  MISSION_CREATE: "mission.create",
  MISSION_CLAIM: "mission.claim",
  EMPLOYEE_EXECUTION: "employee.execution",
  ACTION_RUNTIME: "action.runtime",
  MISSION_COMPLETE: "mission.complete",
  QUEUE_STATE: "queue.state",
} as const;

export type CriticalOperation =
  (typeof CriticalOperation)[keyof typeof CriticalOperation];

/** Side-effects derivados — nunca derrubam missao concluida. */
export const NonCriticalOperation = {
  OPERATIONAL_MEMORY: "memory.operational",
  ANALYTICS: "analytics",
  METRICS: "metrics",
  TELEMETRY: "telemetry",
  LEARNING: "learning",
  USAGE_STATISTICS: "usage.statistics",
} as const;

export type NonCriticalOperation =
  (typeof NonCriticalOperation)[keyof typeof NonCriticalOperation];

export type KnownOperation = CriticalOperation | NonCriticalOperation;

const CRITICAL_SET = new Set<string>(Object.values(CriticalOperation));
const NON_CRITICAL_SET = new Set<string>(Object.values(NonCriticalOperation));

export function classifyOperation(operation: string): OperationCriticality {
  if (NON_CRITICAL_SET.has(operation)) {
    return OperationCriticality.NON_CRITICAL;
  }
  if (CRITICAL_SET.has(operation)) {
    return OperationCriticality.CRITICAL;
  }
  // Desconhecido: conservador — trata como CRITICAL se aparenta missao/fila;
  // memoria/learning/metrics → NON_CRITICAL.
  if (
    /memory|learning|analytics|metric|telemetry|usage|digest/i.test(operation)
  ) {
    return OperationCriticality.NON_CRITICAL;
  }
  return OperationCriticality.CRITICAL;
}
