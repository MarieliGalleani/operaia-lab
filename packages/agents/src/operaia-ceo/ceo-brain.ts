import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import {
  Specialization,
  type EmployeeBrain,
  type EmployeeBriefing,
  type EmployeeDecision,
  type EmployeeReport,
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

/** Entrega de especialista anexada ao briefing pela Activation Layer. */
interface SpecialistOutcomeBrief {
  readonly matched: boolean;
  readonly specialization: string;
  readonly reason: string;
  readonly task?: string;
  readonly employeeId?: string;
  readonly report?: EmployeeReport;
  readonly qualityPassed?: boolean;
}

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
 *
 * Quando o briefing traz `additional.delegationOutcomes`, entra em modo
 * consolidacao: revisa entregas dos especialistas, nao redelega no mesmo ciclo
 * e responde como porta-voz da organizacao.
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
    const specialistOutcomes = readSpecialistOutcomes(briefing);
    if (specialistOutcomes.length > 0) {
      return this.consolidate(briefing, specialistOutcomes);
    }
    return this.planAndDelegate(briefing);
  }

  /** Ciclo inicial: analisa workspace, prioriza e pode pedir especialidades. */
  private async planAndDelegate(
    briefing: EmployeeBriefing,
  ): Promise<EmployeeDecision> {
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

  /**
   * Ciclo de review: consolida entregas dos especialistas e responde ao usuario.
   * Nao emite novas delegacoes neste passo (evita loop no mesmo pedido).
   */
  private async consolidate(
    briefing: EmployeeBriefing,
    outcomes: readonly SpecialistOutcomeBrief[],
  ): Promise<EmployeeDecision> {
    const review = this.reviewer.review(briefing);
    const priorities = this.prioritizer.prioritize(briefing.tasks);
    const matched = outcomes.filter((outcome) => outcome.matched);
    const unmatched = outcomes.filter((outcome) => !outcome.matched);

    const recommendations = [
      "Revisar entregas dos especialistas.",
      ...matched.map(
        (outcome) =>
          `Integrar plano de ${outcome.employeeId ?? outcome.specialization}.`,
      ),
      ...unmatched.map(
        (outcome) =>
          `Especialidade ${outcome.specialization} indisponivel: ${outcome.reason}.`,
      ),
      "Reportar ao usuario em linguagem executiva.",
    ];

    const specialistRisks = outcomes.flatMap((outcome) => {
      if (!outcome.matched) {
        return [
          `Sem especialista para ${outcome.specialization} (${outcome.reason}).`,
        ];
      }
      return outcome.report?.risks ?? [];
    });

    const specialistActions = matched.flatMap(
      (outcome) => outcome.report?.nextActions ?? [],
    );

    const narrative = await this.generateConsolidationSummary(
      briefing,
      outcomes,
      review,
    );

    return {
      analyzed:
        `${briefing.project}: consolidacao de ${outcomes.length} delegacao(oes) ` +
        `(${matched.length} atendida(s), ${unmatched.length} sem especialista).`,
      decision: narrative,
      reasoning:
        "Porta-voz da organizacao: revisei as entregas especializadas, " +
        "priorizei o que importa para o objetivo e preparei a resposta ao usuario.",
      recommendations,
      delegations: [],
      risks: [...review.findings, ...specialistRisks],
      nextActions: [
        ...specialistActions.slice(0, TOP_ACTIONS),
        ...priorities
          .slice(0, Math.max(0, TOP_ACTIONS - specialistActions.length))
          .map((task) => `[${task.priority}] ${task.title}`),
      ].slice(0, TOP_ACTIONS),
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

  private async generateConsolidationSummary(
    briefing: EmployeeBriefing,
    outcomes: readonly SpecialistOutcomeBrief[],
    review: CeoReview,
  ): Promise<string> {
    const specialistBlock = outcomes
      .map((outcome, index) => {
        if (!outcome.matched || !outcome.report) {
          return (
            `${index + 1}. ${outcome.specialization}: SEM ESPECIALISTA ` +
            `(${outcome.reason})`
          );
        }
        return [
          `${index + 1}. ${outcome.employeeId} (${outcome.specialization}):`,
          `   Resumo: ${outcome.report.summary}`,
          `   Plano: ${outcome.report.plan.join(" | ") || "(vazio)"}`,
          `   Proximas acoes: ${outcome.report.nextActions.join(" | ") || "(vazio)"}`,
        ].join("\n");
      })
      .join("\n");

    const messages: LLMMessage[] = [
      { role: "system", content: buildCeoSystemPrompt() },
      {
        role: "user",
        content: [
          "Modo: consolidacao apos delegacao. Voce e a porta-voz da organizacao.",
          "Nao devolva o relatorio bruto do especialista; sintetize para o usuario.",
          `Objetivo: ${briefing.objective}`,
          `Workspace: ${briefing.project}`,
          `Pendencias: ${review.pendingCount}; bloqueadas: ${review.blockedCount}`,
          "Entregas dos especialistas:",
          specialistBlock || "- (nenhuma)",
          "Escreva um resumo executivo curto (2-4 frases) consolidando a situacao,",
          "o que a equipe entregou e as proximas acoes para o usuario.",
        ].join("\n"),
      },
    ];

    const completion = await this.llm.complete(messages);
    return completion.content.trim();
  }
}

function readSpecialistOutcomes(
  briefing: EmployeeBriefing,
): readonly SpecialistOutcomeBrief[] {
  const raw = briefing.additional["delegationOutcomes"];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isSpecialistOutcomeBrief);
}

function isSpecialistOutcomeBrief(
  value: unknown,
): value is SpecialistOutcomeBrief {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["matched"] === "boolean" &&
    typeof record["specialization"] === "string" &&
    typeof record["reason"] === "string"
  );
}
