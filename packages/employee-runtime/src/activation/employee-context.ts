import type { ActionCapabilityProvider } from "@operaia/action-runtime";
import type {
  EmployeeDelivery,
  WorkspaceSnapshot,
} from "@operaia/employee-framework";
import type { ToolContext } from "@operaia/tool-runtime";
import type { DelegationOutcome } from "../delegation/delegation-service.js";

/**
 * Resumo normalizado de uma Action executada (contrato unico).
 * Texto/dados puros — sem acoplar o funcionario ao Execution Engine.
 */
export interface ExecutionSummaryNote {
  readonly actionId: string;
  readonly actionType: string;
  readonly status: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly duration: number;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

/**
 * Delivery de uma Mission anterior injetada no contexto (F5).
 */
export interface PreviousDeliveryContext {
  readonly sourceMissionId: string;
  readonly delivery: EmployeeDelivery;
}

/**
 * Contexto de negocio para uma execucao de funcionario.
 *
 * `tools` (ToolContext) — ToolPermissionPolicy; sem adapters concretos.
 * `actions` (ActionCapabilityProvider) — ActionRuntime.requestAction; sem shell.
 */
export interface EmployeeContext {
  readonly workspace: WorkspaceSnapshot;
  readonly objective: string;
  readonly memoryNotes?: readonly string[];
  readonly delegationOutcomes?: readonly DelegationOutcome[];
  readonly executionSummaries?: readonly ExecutionSummaryNote[];
  readonly tools?: ToolContext;
  readonly actions?: ActionCapabilityProvider | null;
  /** Delivery DELIVERED de Mission EXECUTE anterior (F5). */
  readonly previousDelivery?: PreviousDeliveryContext;
}
