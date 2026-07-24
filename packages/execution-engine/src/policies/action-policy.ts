import type { Action } from "../execution/action.js";
import type { ExecutionContext } from "../execution/execution-context.js";

/** Decisao da Policy Layer para uma Action. */
export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Contrato da Policy Layer.
 *
 * Fluxo oficial por Action:
 *   canExecute → validate → (Registry resolve) → execute → normalizeResult
 */
export interface ActionPolicy {
  canExecute(
    action: Action,
    context: ExecutionContext,
  ): PolicyDecision | Promise<PolicyDecision>;

  validate?(
    action: Action,
    context: ExecutionContext,
  ): PolicyDecision | Promise<PolicyDecision>;
}

/** Politica permissiva (default quando nenhuma e injetada). */
export class AllowAllActionPolicy implements ActionPolicy {
  canExecute(): PolicyDecision {
    return { allowed: true };
  }

  validate(): PolicyDecision {
    return { allowed: true };
  }
}

/**
 * Allowlist por tipo de Action.
 * Tipos fora da lista sao negados (SKIPPED), sem chamar o executor.
 */
export class AllowlistActionPolicy implements ActionPolicy {
  private readonly allowed: ReadonlySet<string>;

  constructor(allowedTypes: readonly string[]) {
    this.allowed = new Set(allowedTypes);
  }

  canExecute(action: Action): PolicyDecision {
    if (this.allowed.has(action.type)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Policy negou Action type nao permitida: ${action.type}`,
    };
  }

  validate(action: Action): PolicyDecision {
    if (!action.id || !action.type) {
      return {
        allowed: false,
        reason: "Policy: Action invalida (id/type ausente).",
      };
    }
    return { allowed: true };
  }
}
