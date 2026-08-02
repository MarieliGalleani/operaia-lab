import type { EmployeeBriefing } from "@operaia/employee-framework";
import { parseMissionIntentMarker } from "@operaia/mission-router";
import type { CeoReview, PrioritizedTask } from "./ceo-types.js";

/**
 * Resposta executiva imediata (sem LLM) quando a CEO nao precisa delegar.
 *
 * A.5.1: OPERATIONAL_REVIEW usa template de analise; GENERAL_CONVERSATION
 * responde de forma contextual (sem reuniao operacional completa).
 */
export function buildDirectExecutiveReply(
  briefing: EmployeeBriefing,
  review: CeoReview,
  priorities: readonly PrioritizedTask[],
): string {
  const intent = parseMissionIntentMarker(briefing.objective)?.intentType;

  if (intent === "GENERAL_CONVERSATION") {
    return buildConversationalCeoReply(briefing, review, priorities);
  }

  return buildOperationalReviewReply(briefing, review, priorities);
}

/**
 * OPERATIONAL_REVIEW — analise de workspace / pendencias / proximos passos.
 */
export function buildOperationalReviewReply(
  briefing: EmployeeBriefing,
  review: CeoReview,
  priorities: readonly PrioritizedTask[],
): string {
  const top = priorities
    .slice(0, 3)
    .map((task) => `${task.title}`)
    .join("; ");

  if (review.objectiveAchieved || priorities.length === 0) {
    return (
      `${briefing.project} esta alinhado ao objetivo do ciclo. ` +
      "Nao ha trabalho tecnico pendente para delegar agora; " +
      "podemos revisar prioridades ou abrir uma nova missao quando quiser."
    );
  }

  return (
    `Analisei ${briefing.project} em relacao ao que merece atencao agora. ` +
    `Ha ${review.pendingCount} pendencia(s)` +
    (review.blockedCount > 0 ? ` e ${review.blockedCount} bloqueada(s)` : "") +
    `. Foco imediato: ${top || "decompor o objetivo em tarefas"}. ` +
    "Posso coordenar a equipe quando a missao exigir execucao especializada."
  );
}

/**
 * GENERAL_CONVERSATION — pergunta contextual (ex.: "quais projetos temos?").
 * Sem template de reuniao operacional.
 */
export function buildConversationalCeoReply(
  briefing: EmployeeBriefing,
  review: CeoReview,
  priorities: readonly PrioritizedTask[],
): string {
  const question = extractUserQuestion(briefing.objective);
  const pendingHint =
    review.pendingCount > 0
      ? ` No quadro de ${briefing.project} ha ${review.pendingCount} pendencia(s).`
      : ` ${briefing.project} nao tem pendencias abertas no momento.`;

  if (/projet/i.test(question)) {
    const summary = briefing.executiveSummary.trim();
    return (
      `No escritorio, o workspace em foco e ${briefing.project}. ` +
      (summary ? `${summary} ` : "") +
      pendingHint.trimStart() +
      (priorities[0] ? ` Item em destaque: ${priorities[0].title}.` : "") +
      " Posso detalhar status, riscos ou abrir uma missao tecnica se quiser."
    );
  }

  return (
    `Sobre "${question || "sua pergunta"}": estou no contexto de ${briefing.project}.` +
    pendingHint +
    " Posso fazer uma revisao operacional completa, priorizar pendencias ou " +
    "encaminhar implementacao para a equipe — e so dizer o que precisa."
  );
}

function extractUserQuestion(objective: string): string {
  const markerSplit = objective.split(/\n\n/);
  if (markerSplit.length >= 2 && objective.includes("[MISSION_INTENT]")) {
    return markerSplit.slice(1).join("\n\n").trim();
  }
  return objective.trim();
}
