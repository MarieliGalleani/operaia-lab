import type { EmployeeBriefing } from "../briefing/employee-briefing.js";
import type { EmployeeInput } from "../contracts/employee-input.js";
import type { EmployeeOutput } from "../contracts/employee-output.js";
import type { EmployeeDecision } from "../decision/decision-model.js";
import type { EmployeeProfile } from "./employee-profile.js";

/**
 * O cerebro de especializacao: a UNICA coisa que um novo funcionario implementa.
 * Recebe um Briefing e devolve uma decisao no modelo comum.
 */
export interface EmployeeBrain {
  decide(briefing: EmployeeBriefing): Promise<EmployeeDecision>;
}

/** Contrato unico de qualquer funcionario digital. */
export interface Employee {
  readonly profile: EmployeeProfile;
  work(input: EmployeeInput): Promise<EmployeeOutput>;
}
