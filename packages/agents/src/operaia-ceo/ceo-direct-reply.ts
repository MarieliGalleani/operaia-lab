import type { EmployeeBriefing } from "@operaia/employee-framework";
import type { CeoReview, PrioritizedTask } from "./ceo-types.js";

/**
 * Resposta executiva imediata (sem LLM) quando a CEO nao precisa delegar.
 * Mantem tom de porta-voz sem custo de rede.
 */
export function buildDirectExecutiveReply(
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
      `${briefing.project} esta alinhado ao objetivo "${briefing.objective}". ` +
      "Nao ha trabalho tecnico pendente para delegar agora; " +
      "podemos revisar prioridades ou abrir uma nova missao quando quiser."
    );
  }

  return (
    `Analisei ${briefing.project} em relacao a "${briefing.objective}". ` +
    `Ha ${review.pendingCount} pendencia(s)` +
    (review.blockedCount > 0 ? ` e ${review.blockedCount} bloqueada(s)` : "") +
    `. Foco imediato: ${top || "decompor o objetivo em tarefas"}. ` +
    "Posso coordenar a equipe quando a missao exigir execucao especializada."
  );
}
