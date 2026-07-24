import type { ActionOutput, ActionStatus } from "../execution/action.js";
import type { ActionResult } from "../execution/execution-result.js";

/**
 * Contrato unico normalizado de resultado por Action.
 * Evita retornos especificos de cada executor na borda da missao.
 */
export interface NormalizedActionResult {
  readonly actionId: string;
  readonly actionType: string;
  readonly status: ActionStatus;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly duration: number;
  readonly output?: ActionOutput;
  readonly error?: string;
  readonly executor?: string | null;
}

/** Normaliza ActionResult do Engine para o contrato unico. */
export function normalizeActionResult(
  result: ActionResult,
): NormalizedActionResult {
  return {
    actionId: result.actionId,
    actionType: result.type,
    status: result.status,
    startedAt: result.startedAt.toISOString(),
    finishedAt: result.finishedAt.toISOString(),
    duration: result.durationMs,
    ...(result.output !== undefined ? { output: result.output } : {}),
    ...(result.error !== undefined ? { error: result.error } : {}),
    executor: result.executor,
  };
}

export function normalizeExecutionResults(
  results: readonly ActionResult[],
): readonly NormalizedActionResult[] {
  return results.map(normalizeActionResult);
}
