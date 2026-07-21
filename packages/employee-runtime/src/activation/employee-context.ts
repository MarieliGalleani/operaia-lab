import type { WorkspaceSnapshot } from "@operaia/employee-framework";

/**
 * Contexto de negocio para uma execucao de funcionario.
 * Contem apenas informacao de dominio (snapshot do Workspace + objetivo);
 * nenhuma referencia a infraestrutura, banco ou engines.
 */
export interface EmployeeContext {
  readonly workspace: WorkspaceSnapshot;
  readonly objective: string;
}
