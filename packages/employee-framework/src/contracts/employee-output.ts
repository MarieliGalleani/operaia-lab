import type { EmployeeDecision } from "../decision/decision-model.js";
import type { QualityResult } from "../decision/quality-policy.js";
import type { EmployeeReport } from "./employee-report.js";

/** Saida de trabalho: a decisao, a entrega padronizada e o resultado da qualidade. */
export interface EmployeeOutput {
  readonly decision: EmployeeDecision;
  readonly report: EmployeeReport;
  readonly quality: QualityResult;
}
