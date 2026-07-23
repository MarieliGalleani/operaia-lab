import type { WorkspaceSnapshot } from "@operaia/employee-framework";
import type { DelegationOutcome } from "../delegation/delegation-service.js";

/**
 * Contexto de negocio para uma execucao de funcionario.
 * Contem apenas informacao de dominio (snapshot do Workspace + objetivo);
 * nenhuma referencia a infraestrutura, banco ou engines.
 *
 * `delegationOutcomes` carrega entregas de especialistas ja executados
 * (ex.: para a Opera consolidar antes de responder ao usuario). A interpretacao
 * desses resultados e responsabilidade do EmployeeBrain, nao da orquestracao.
 */
export interface EmployeeContext {
  readonly workspace: WorkspaceSnapshot;
  readonly objective: string;
  readonly delegationOutcomes?: readonly DelegationOutcome[];
}
