/**
 * Resultado padronizado de qualquer acao controlada.
 */
import type { ActionId } from "./action-id.js";
import type { ActionExecutionStatus } from "./action-types.js";

export interface ActionResultMetadata {
  readonly executionId?: string;
  readonly status?: ActionExecutionStatus;
  readonly workspaceId?: string;
  readonly target?: string;
  readonly durationMs?: number;
  readonly [key: string]: unknown;
}

export interface ActionResult {
  readonly success: boolean;
  readonly actionId: string;
  readonly output: unknown | null;
  readonly error: string | null;
  readonly metadata: ActionResultMetadata;
}

export function actionOk(input: {
  readonly actionId: ActionId | string;
  readonly output?: unknown;
  readonly metadata?: ActionResultMetadata;
}): ActionResult {
  return {
    success: true,
    actionId: input.actionId,
    output: input.output ?? null,
    error: null,
    metadata: input.metadata ?? {},
  };
}

export function actionFail(input: {
  readonly actionId: ActionId | string;
  readonly error: string;
  readonly metadata?: ActionResultMetadata;
  readonly output?: unknown;
}): ActionResult {
  return {
    success: false,
    actionId: input.actionId,
    output: input.output ?? null,
    error: input.error,
    metadata: input.metadata ?? {},
  };
}
