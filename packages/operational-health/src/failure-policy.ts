/**
 * FailurePolicy — garante que falhas NON_CRITICAL nao revertam SUCCESS.
 */
import {
  OperationCriticality,
  classifyOperation,
  type KnownOperation,
} from "./operation-criticality.js";
import { logOperationalEvent } from "./observability.js";

export interface FailurePolicyContext {
  readonly operation: KnownOperation | string;
  readonly workspaceId?: string;
  readonly correlationId?: string;
  readonly component?: string;
}

export interface NonCriticalRunInput<T> extends FailurePolicyContext {
  readonly run: () => Promise<T>;
  readonly onFailure?: (error: unknown) => void;
}

export interface FailurePolicyDecision {
  readonly criticality: OperationCriticality;
  /** true = excecao deve propagar e pode falhar a missao. */
  readonly shouldFailMission: boolean;
  readonly reason: string;
}

/**
 * Politica permanente pos-incidente A.D1.
 */
export class FailurePolicy {
  decide(operation: string): FailurePolicyDecision {
    const criticality = classifyOperation(operation);
    if (criticality === OperationCriticality.NON_CRITICAL) {
      return {
        criticality,
        shouldFailMission: false,
        reason:
          "Operacao NON_CRITICAL — falha isolada; missao SUCCESS permanece",
      };
    }
    return {
      criticality,
      shouldFailMission: true,
      reason: "Operacao CRITICAL — falha pode terminalizar a missao",
    };
  }

  /**
   * Executa side-effect NON_CRITICAL. Em erro: loga, chama onFailure, retorna undefined.
   * Nunca relanca — caller CRITICAL (mission.complete) ja ocorreu.
   */
  async runNonCritical<T>(
    input: NonCriticalRunInput<T>,
  ): Promise<T | undefined> {
    const decision = this.decide(input.operation);
    if (decision.shouldFailMission) {
      throw new Error(
        `FailurePolicy.runNonCritical recebeu operacao CRITICAL: ${input.operation}`,
      );
    }

    try {
      return await input.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logOperationalEvent({
        event: "operation_criticality",
        severity: "warn",
        component: input.component ?? "failure-policy",
        workspaceId: input.workspaceId,
        correlationId: input.correlationId,
        payload: {
          operation: input.operation,
          criticality: decision.criticality,
          shouldFailMission: false,
          error: message,
          stack,
        },
      });
      input.onFailure?.(error);
      return undefined;
    }
  }
}

export const defaultFailurePolicy = new FailurePolicy();
