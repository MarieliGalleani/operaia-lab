/**
 * ActionCapabilityProvider — capacidade operacional exposta ao Employee.
 * Nunca expoe adapters; sempre passa por ActionRuntime (policy + ledger).
 */
import type { ActionRequest } from "./action-request.js";
import type { ActionResult } from "./action-result.js";
import type { ActionRuntime } from "./action-runtime.js";

/**
 * Pedido do Employee — sem workspaceId/requestedBy (fixidos pelo provider).
 */
export interface ActionCapabilityRequest {
  readonly actionId: ActionRequest["actionId"];
  readonly target: string;
  readonly parameters?: ActionRequest["parameters"];
}

export interface ActionCapabilityProviderOptions {
  readonly runtime: ActionRuntime;
  readonly employeeId: string;
  readonly workspaceId: string;
}

export class ActionCapabilityProvider {
  readonly employeeId: string;
  readonly workspaceId: string;
  private readonly runtime: ActionRuntime;

  constructor(options: ActionCapabilityProviderOptions) {
    this.runtime = options.runtime;
    this.employeeId = options.employeeId;
    this.workspaceId = options.workspaceId;
  }

  /**
   * Solicita acao operacional controlada.
   * Employee nao escolhe workspace/requestedBy — isolamento garantido aqui.
   */
  requestAction(input: ActionCapabilityRequest): Promise<ActionResult> {
    return this.runtime.execute({
      workspaceId: this.workspaceId,
      requestedBy: this.employeeId,
      actionId: input.actionId,
      target: input.target,
      parameters: input.parameters,
    });
  }
}

export function createActionCapabilityProvider(
  options: ActionCapabilityProviderOptions,
): ActionCapabilityProvider {
  return new ActionCapabilityProvider(options);
}
