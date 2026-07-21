import type {
  EmployeeBriefing,
  EmployeeOutput,
  EmployeeProfile,
} from "@operaia/employee-framework";

/**
 * Resultado de uma execucao de funcionario dentro do Workspace: quem executou,
 * com qual briefing e o que entregou. Auditavel de ponta a ponta.
 */
export interface EmployeeResult {
  readonly employeeId: string;
  readonly profile: EmployeeProfile;
  readonly briefing: EmployeeBriefing;
  readonly output: EmployeeOutput;
}
