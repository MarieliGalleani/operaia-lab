import type { EmployeeBriefing } from "../briefing/employee-briefing.js";

/** Entrada de trabalho de um funcionario: sempre um Briefing de negocio. */
export interface EmployeeInput {
  readonly briefing: EmployeeBriefing;
}
