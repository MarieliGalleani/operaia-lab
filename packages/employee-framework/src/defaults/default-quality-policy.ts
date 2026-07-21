import type { EmployeeReport } from "../contracts/employee-report.js";
import type { EmployeeDecision } from "../decision/decision-model.js";
import type {
  QualityIssue,
  QualityPolicy,
  QualityResult,
} from "../decision/quality-policy.js";
import type { EmployeeProfile } from "../employee/employee-profile.js";

/** Regras minimas de qualidade compartilhadas por todos os funcionarios. */
export class DefaultQualityPolicy implements QualityPolicy {
  validate(
    decision: EmployeeDecision,
    report: EmployeeReport,
    _profile: EmployeeProfile,
  ): QualityResult {
    const issues: QualityIssue[] = [];

    if (!report.summary.trim()) {
      issues.push({ rule: "summary", message: "Resumo vazio." });
    }
    if (!report.analysis.trim()) {
      issues.push({ rule: "analysis", message: "Analise vazia." });
    }
    if (!decision.reasoning.trim()) {
      issues.push({ rule: "reasoning", message: "Decisao sem justificativa." });
    }
    if (report.plan.length === 0 && report.nextActions.length === 0) {
      issues.push({
        rule: "actionability",
        message: "Entrega sem plano nem proximas acoes.",
      });
    }

    return { passed: issues.length === 0, issues };
  }
}
