import type { EmployeeBriefing } from "../briefing/employee-briefing.js";
import type { EmployeeReport } from "../contracts/employee-report.js";
import type { EmployeeDecision } from "../decision/decision-model.js";
import type { ResponsePolicy } from "../decision/response-policy.js";

/** Politica de resposta padrao: monta as 6 secoes executivas a partir da decisao. */
export class DefaultResponsePolicy implements ResponsePolicy {
  build(decision: EmployeeDecision, briefing: EmployeeBriefing): EmployeeReport {
    return {
      summary: decision.decision || `Analise do objetivo: ${briefing.objective}`,
      analysis:
        [decision.analyzed, decision.reasoning].filter(Boolean).join(" ").trim() ||
        "Sem analise adicional.",
      plan: decision.recommendations,
      recommendations:
        decision.delegations.length > 0
          ? decision.delegations.map(
              (item) => `Delegar para ${item.specialization}: ${item.reason}`,
            )
          : ["Nenhuma delegacao necessaria."],
      risks:
        decision.risks.length > 0
          ? decision.risks
          : ["Nenhum risco relevante identificado."],
      nextActions: decision.nextActions,
    };
  }

  render(report: EmployeeReport): string {
    const section = (title: string, lines: readonly string[]): string =>
      `## ${title}\n${lines.map((line) => `- ${line}`).join("\n")}`;

    return [
      `## Resumo\n${report.summary}`,
      `## Analise\n${report.analysis}`,
      section("Plano", report.plan),
      section("Recomendacoes", report.recommendations),
      section("Riscos", report.risks),
      section("Proximas acoes", report.nextActions),
    ].join("\n\n");
  }
}
