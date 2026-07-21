import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import {
  Specialization,
  type EmployeeBrain,
  type EmployeeBriefing,
  type EmployeeDecision,
} from "@operaia/employee-framework";
import { CeoPlanner } from "./ceo-planner.js";
import { CeoPrioritizer } from "./ceo-prioritizer.js";
import { CeoReviewer } from "./ceo-reviewer.js";
import { buildCeoSystemPrompt } from "./ceo-system-prompt.js";
import {
  CeoPlanAction,
  type CeoPlan,
  type CeoReview,
  type PrioritizedTask,
} from "./ceo-types.js";

const TOP_ACTIONS = 3;

export interface CeoBrainDependencies {
  readonly llm: LLMProvider;
  readonly planner?: CeoPlanner;
  readonly prioritizer?: CeoPrioritizer;
  readonly reviewer?: CeoReviewer;
}

/**
 * Cerebro do OperaIA CEO como especializacao do Employee Framework.
 *
 * As decisoes estruturais sao deterministicas (planner/prioritizer/reviewer);
 * o LLM produz apenas o resumo executivo. Comportamento identico ao anterior,
 * agora expresso no contrato comum (EmployeeDecision).
 */
export class CeoBrain implements EmployeeBrain {
  private readonly llm: LLMProvider;
  private readonly planner: CeoPlanner;
  private readonly prioritizer: CeoPrioritizer;
  private readonly reviewer: CeoReviewer;

  constructor(deps: CeoBrainDependencies) {
    this.llm = deps.llm;
    this.planner = deps.planner ?? new CeoPlanner();
    this.prioritizer = deps.prioritizer ?? new CeoPrioritizer();
    this.reviewer = deps.reviewer ?? new CeoReviewer();
  }

  async decide(briefing: EmployeeBriefing): Promise<EmployeeDecision> {
    const plan = this.planner.plan(briefing);
    const priorities = this.prioritizer.prioritize(briefing.tasks);
    const review = this.reviewer.review(briefing);
    const narrative = await this.generateSummary(
      briefing,
      plan,
      review,
      priorities,
    );

    const shouldDelegate =
      priorities.length > 0 &&
      plan.steps.some((step) => step.action === CeoPlanAction.DELEGATE);

    return {
      analyzed:
        `${briefing.project}: ${review.pendingCount} pendente(s), ` +
        `${review.blockedCount} bloqueada(s).`,
      decision: narrative,
      reasoning:
        "Priorizacao por impacto, urgencia, risco, dependencias e esforco. " +
        (priorities[0]
          ? `Foco imediato: ${priorities[0].title} (${priorities[0].rationale}).`
          : "Sem tarefas priorizaveis; objetivo precisa ser decomposto."),
      recommendations: plan.steps.map((step) => `${step.order}. ${step.title}`),
      delegations: shouldDelegate
        ? [
            {
              specialization: Specialization.SOFTWARE_ENGINEERING,
              reason: "Executar as tarefas de implementacao priorizadas.",
              task: priorities[0]?.title,
            },
          ]
        : [],
      risks: review.findings,
      nextActions: priorities
        .slice(0, TOP_ACTIONS)
        .map((task) => `[${task.priority}] ${task.title}`),
    };
  }

  private async generateSummary(
    briefing: EmployeeBriefing,
    plan: CeoPlan,
    review: CeoReview,
    priorities: readonly PrioritizedTask[],
  ): Promise<string> {
    const top = priorities
      .slice(0, TOP_ACTIONS)
      .map((task) => `- [${task.priority}] ${task.title}`)
      .join("\n");

    const messages: LLMMessage[] = [
      { role: "system", content: buildCeoSystemPrompt() },
      {
        role: "user",
        content: [
          `Objetivo: ${briefing.objective}`,
          `Workspace: ${briefing.project}`,
          `Tarefas: ${briefing.tasks.length} (${review.pendingCount} em aberto, ${review.blockedCount} bloqueadas)`,
          `Plano: ${plan.steps.map((step) => step.title).join(" -> ")}`,
          `Prioridades:\n${top || "- (sem tarefas priorizadas)"}`,
          "Escreva um resumo executivo curto (2-3 frases) da situacao e do plano.",
        ].join("\n"),
      },
    ];

    const completion = await this.llm.complete(messages);
    return completion.content.trim();
  }
}
