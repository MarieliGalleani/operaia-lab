import type { EmployeeReport } from "../contracts/employee-report.js";
import type { EmployeeProfile } from "../employee/employee-profile.js";
import type { EmployeeDecision } from "./decision-model.js";

export interface QualityIssue {
  readonly rule: string;
  readonly message: string;
}

export interface QualityResult {
  readonly passed: boolean;
  readonly issues: readonly QualityIssue[];
}

/** Todo funcionario valida a propria entrega antes de finalizar. */
export interface QualityPolicy {
  validate(
    decision: EmployeeDecision,
    report: EmployeeReport,
    profile: EmployeeProfile,
  ): QualityResult;
}
