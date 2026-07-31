import type { WorkspaceSnapshot } from "@operaia/employee-framework";
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
 * Contexto de negocio para uma execucao de funcionario.
 * Contem apenas informacao de dominio (snapshot do Workspace + objetivo);
 * nenhuma referencia a infraestrutura, banco ou engines.
 *
 * `delegationOutcomes` carrega entregas de especialistas ja executados
 * (ex.: para a Opera consolidar antes de responder ao usuario). A interpretacao
 * desses resultados e responsabilidade do EmployeeBrain, nao da orquestracao.
 *
 * `memoryNotes` carrega fatos recuperados da Memory (texto puro). O Runner
 * injeta no briefing; funcionarios nao conhecem MemoryStore.
 *
 * `executionSummaries` carrega resultados do Execution Engine (apos Policy).
 *
 * `tools` (ToolContext) expoe ferramentas permitidas pela ToolPermissionPolicy.
 * O Employee nunca conhece adapters concretos.
 */
export interface EmployeeContext {
  readonly workspace: WorkspaceSnapshot;
  readonly objective: string;
  readonly memoryNotes?: readonly string[];
  readonly delegationOutcomes?: readonly DelegationOutcome[];
  readonly executionSummaries?: readonly ExecutionSummaryNote[];
  readonly tools?: ToolContext;
}
