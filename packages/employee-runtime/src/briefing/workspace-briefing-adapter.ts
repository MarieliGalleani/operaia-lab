import {
  BriefingBuilder,
  type EmployeeBriefing,
  type WorkspaceSnapshot,
} from "@operaia/employee-framework";

/**
 * UNICO ponto de adaptacao Workspace -> EmployeeBriefing nesta camada.
 *
 * Recebe o snapshot de NEGOCIO do Workspace e o objetivo e produz o briefing
 * puro que o funcionario consome. A traducao a partir do Workspace real de
 * infraestrutura (persistencia, sessoes) acontece antes, ao montar o snapshot,
 * nunca dentro dos funcionarios.
 */
export class WorkspaceBriefingAdapter {
  constructor(private readonly builder: BriefingBuilder = new BriefingBuilder()) {}

  toBriefing(
    workspace: WorkspaceSnapshot,
    objective: string,
  ): EmployeeBriefing {
    return this.builder.build(workspace, objective);
  }
}
