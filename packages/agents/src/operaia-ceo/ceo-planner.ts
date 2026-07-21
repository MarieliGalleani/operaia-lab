import type { EmployeeBriefing } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import {
  CeoPlanAction,
  type CeoPlan,
  type CeoPlanStep,
} from "./ceo-types.js";

/**
 * Transforma um Briefing em um plano de etapas gerenciais. Deterministico e
 * adaptativo ao estado real do projeto.
 *
 * Ex.: "Finalizar a NEXO" ->
 *   Analisar Workspace -> Revisar pendencias -> Criar tarefas ->
 *   Atualizar roadmap -> Delegar implementacao -> Reportar
 */
export class CeoPlanner {
  plan(briefing: EmployeeBriefing): CeoPlan {
    const pending = briefing.tasks.filter(
      (task) => task.status !== TaskStatus.DONE,
    );
    const steps: CeoPlanStep[] = [];

    const push = (action: CeoPlanAction, title: string, rationale: string) => {
      steps.push({ order: steps.length + 1, action, title, rationale });
    };

    push(
      CeoPlanAction.ANALYZE_WORKSPACE,
      "Analisar o Workspace",
      "Entender objetivo, tarefas, sessoes, documentacao e roadmap atuais.",
    );

    push(
      CeoPlanAction.REVIEW_PENDING,
      "Revisar pendencias",
      `Ha ${pending.length} tarefa(s) em aberto a avaliar.`,
    );

    if (pending.length === 0) {
      push(
        CeoPlanAction.CREATE_TASKS,
        "Criar tarefas",
        "Objetivo ainda nao decomposto em trabalho acionavel.",
      );
    }

    const hasRoadmap =
      Array.isArray(briefing.additional["roadmap"]) &&
      (briefing.additional["roadmap"] as unknown[]).length > 0;
    if (hasRoadmap || pending.length > 0) {
      push(
        CeoPlanAction.UPDATE_ROADMAP,
        "Atualizar roadmap",
        "Alinhar a sequencia de entrega as prioridades atuais.",
      );
    }

    if (pending.length > 0) {
      push(
        CeoPlanAction.DELEGATE,
        "Delegar implementacao",
        "Encaminhar tarefas de execucao a agentes especialistas.",
      );
    }

    push(
      CeoPlanAction.REPORT,
      "Reportar ao usuario",
      "Comunicar situacao, plano e proximas acoes em linguagem executiva.",
    );

    return { objective: briefing.objective, steps };
  }
}
