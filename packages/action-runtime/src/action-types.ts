/**
 * Tipos transversais do Action Runtime.
 */
import type { ActionId } from "./action-id.js";
import type { ActionRequest } from "./action-request.js";
import type { ActionResult } from "./action-result.js";

export const ActionExecutionStatus = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  DENIED: "DENIED",
} as const;

export type ActionExecutionStatus =
  (typeof ActionExecutionStatus)[keyof typeof ActionExecutionStatus];

/**
 * Contrato de adapter — dependencias injetaveis, sem child_process nos Employees.
 */
export interface ActionAdapter {
  readonly supportedActions: readonly ActionId[];
  execute(request: ActionRequest): Promise<ActionResult>;
}

export interface ActionExecutionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly employeeId: string;
  readonly actionId: string;
  readonly target: string;
  readonly status: ActionExecutionStatus;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly result: unknown | null;
  readonly error: string | null;
}

/**
 * Escopo de targets permitidos por workspace (isolamento).
 */
export interface WorkspaceActionScope {
  isTargetAllowed(workspaceId: string, target: string): Promise<boolean>;
}

export class MapWorkspaceActionScope implements WorkspaceActionScope {
  constructor(
    private readonly allowed: Readonly<Record<string, readonly string[]>>,
  ) {}

  async isTargetAllowed(
    workspaceId: string,
    target: string,
  ): Promise<boolean> {
    const list = this.allowed[workspaceId];
    if (!list) {
      return false;
    }
    return list.includes(target);
  }
}
