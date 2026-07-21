import type { EmployeeBriefing } from "../briefing/employee-briefing.js";
import type { EmployeeReport } from "../contracts/employee-report.js";
import type { EmployeeDecision } from "./decision-model.js";

/** Padroniza como uma decisao vira uma entrega (EmployeeReport). */
export interface ResponsePolicy {
  build(decision: EmployeeDecision, briefing: EmployeeBriefing): EmployeeReport;
  render(report: EmployeeReport): string;
}
