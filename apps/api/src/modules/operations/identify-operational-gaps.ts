import type { LLMExecutionEvent } from "@operaia/ai-core";
import type { MissionResult } from "../employees/mission-orchestrator.js";
import type { OperationalGap } from "./operational-run.js";

/**
 * Identifica lacunas reais a partir da execucao — antes de contratar Employees.
 * Nao inventa features; apenas observa o que a missao revelou.
 */
export function identifyOperationalGaps(
  mission: MissionResult,
  llmEvents: readonly LLMExecutionEvent[],
): readonly OperationalGap[] {
  const gaps: OperationalGap[] = [];

  const unmatched = mission.outcomes.filter((outcome) => !outcome.matched);
  for (const outcome of unmatched) {
    gaps.push({
      code: "MISSING_SPECIALIST",
      severity: "warning",
      message:
        `Especialidade ${outcome.request.specialization} solicitada sem funcionario no quadro ` +
        `(${outcome.request.reason}).`,
    });
  }

  const onlyEngineering =
    mission.outcomes.length > 0 &&
    mission.outcomes.every(
      (outcome) =>
        outcome.request.specialization === "SOFTWARE_ENGINEERING",
    );
  if (onlyEngineering) {
    gaps.push({
      code: "NARROW_ROSTER",
      severity: "info",
      message:
        "Quadro atual cobre gestao + engenharia. UX, Produto, Marketing, Financeiro, " +
        "Juridico e Comercial ainda nao foram validados por missao real.",
    });
  }

  const failed = llmEvents.filter((event) => event.type === "call_failed");
  if (failed.length > 0) {
    gaps.push({
      code: "LLM_FAILURES",
      severity: "critical",
      message: `${failed.length} chamada(s) LLM falharam durante a missao.`,
    });
  }

  const providers = llmEvents
    .filter((event) => event.type === "call_succeeded")
    .map((event) => (event.type === "call_succeeded" ? event.provider : ""));
  if (providers.some((name) => name.includes("deterministic"))) {
    gaps.push({
      code: "DETERMINISTIC_LLM",
      severity: "info",
      message:
        "Missao executada com DeterministicLLMProvider (ambiente de teste/controle). " +
        "Em operacao assistida com usuario, usar LLM_PROVIDER=gemini.",
    });
  }

  if (mission.final.output.report.nextActions.length === 0) {
    gaps.push({
      code: "NO_NEXT_ACTIONS",
      severity: "warning",
      message: "Resposta final sem proximas acoes concretas para o usuario.",
    });
  }

  if (!mission.final.output.quality.passed) {
    gaps.push({
      code: "QUALITY_GATE",
      severity: "warning",
      message: "Quality gate da Opera nao passou na consolidacao.",
    });
  }

  return gaps;
}
