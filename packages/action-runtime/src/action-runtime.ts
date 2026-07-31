/**
 * ActionRuntime — fachada segura de capacidade operacional.
 * Employees solicitam acoes tipadas; nao acessam adapters nem infra real.
 */
import type { ActionPolicy } from "./action-policy.js";
import type { ActionRequest } from "./action-request.js";
import type { ActionResult } from "./action-result.js";
import { ActionExecutor } from "./action-executor.js";
import type { ExecutionLedger } from "./ledgers/execution-ledger.js";
import type { ActionAdapter, WorkspaceActionScope } from "./action-types.js";

export interface ActionRuntimeOptions {
  readonly policy?: ActionPolicy;
  readonly ledger: ExecutionLedger;
  readonly adapters: readonly ActionAdapter[];
  readonly scope?: WorkspaceActionScope;
}

export class ActionRuntime {
  private readonly executor: ActionExecutor;
  readonly ledger: ExecutionLedger;

  constructor(options: ActionRuntimeOptions) {
    this.ledger = options.ledger;
    this.executor = new ActionExecutor({
      policy: options.policy,
      ledger: options.ledger,
      adapters: options.adapters,
      scope: options.scope,
    });
  }

  execute(request: ActionRequest): Promise<ActionResult> {
    return this.executor.execute(request);
  }
}

export function createActionRuntime(
  options: ActionRuntimeOptions,
): ActionRuntime {
  return new ActionRuntime(options);
}
