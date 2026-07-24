import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import type {
  EmployeeBrain,
  EmployeeBriefing,
  EmployeeDecision,
  EmployeeTask,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";

const TOP_ACTIONS = 4;

export interface SpecialistDomainConfig {
  readonly domainLabel: string;
  readonly proposedActions: readonly string[];
  readonly systemPrompt: string;
}

/**
 * Brain generico de especialista.
 * Cada Employee configura o dominio; a estrutura de retorno e unica:
 * analise → conclusao → acoes propostas → proximos passos.
 */
export class SpecialistBrain implements EmployeeBrain {
  private readonly llm: LLMProvider;
  private readonly config: SpecialistDomainConfig;

  constructor(llm: LLMProvider, config: SpecialistDomainConfig) {
    this.llm = llm;
    this.config = config;
  }

  async decide(briefing: EmployeeBriefing): Promise<EmployeeDecision> {
    const pending = briefing.tasks.filter((task) => task.status !== TaskStatus.DONE);
    const blocked = briefing.tasks.filter((task) => task.status === TaskStatus.BLOCKED);
    const withDeps = pending.filter((task) => (task.dependsOn?.length ?? 0) > 0);

    const proposedActions =
      pending.length === 0
        ? [
            `Nenhuma tarefa pendente em ${this.config.domainLabel}: consolidar entregas e documentacao.`,
          ]
        : this.config.proposedActions.map(
            (step, index) => `${index + 1}. ${step}`,
          );

    const analysis = this.buildAnalysis(briefing, pending, withDeps, blocked);
    const conclusion = await this.generateConclusion(
      briefing,
      pending,
      proposedActions,
    );

    return {
      analyzed: analysis,
      decision: conclusion,
      reasoning:
        "Contrato do especialista: analise → conclusao → acoes propostas → proximos passos.",
      recommendations: proposedActions,
      delegations: [],
      risks: this.identifyRisks(blocked, withDeps),
      nextActions: this.buildNextSteps(pending, withDeps),
    };
  }

  private buildAnalysis(
    briefing: EmployeeBriefing,
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
    blocked: readonly EmployeeTask[],
  ): string {
    return (
      `Analise de ${this.config.domainLabel} em ${briefing.project} ` +
      `para "${briefing.objective}": ${pending.length} pendente(s), ` +
      `${withDeps.length} com dependencias, ${blocked.length} bloqueada(s).`
    );
  }

  private identifyRisks(
    blocked: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
  ): string[] {
    const risks: string[] = [];
    for (const task of blocked) {
      risks.push(`Tarefa bloqueada: "${task.title}".`);
    }
    for (const task of withDeps) {
      risks.push(
        `"${task.title}" depende de ${task.dependsOn?.join(", ")}; ordenar antes.`,
      );
    }
    if (risks.length === 0) {
      risks.push(`Sem riscos criticos em ${this.config.domainLabel}.`);
    }
    return risks;
  }

  private buildNextSteps(
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
  ): string[] {
    const blockedIds = new Set(withDeps.map((task) => task.id));
    const ready = pending.filter((task) => !blockedIds.has(task.id));
    return [...ready, ...withDeps]
      .slice(0, TOP_ACTIONS)
      .map((task) => `Avancar: ${task.title}`);
  }

  private async generateConclusion(
    briefing: EmployeeBriefing,
    pending: readonly EmployeeTask[],
    proposedActions: readonly string[],
  ): Promise<string> {
    const messages: LLMMessage[] = [
      { role: "system", content: this.config.systemPrompt },
      {
        role: "user",
        content: [
          `Objetivo: ${briefing.objective}`,
          `Projeto: ${briefing.project}`,
          `Dominio: ${this.config.domainLabel}`,
          `Pendencias: ${pending.length}`,
          `Acoes propostas: ${proposedActions.join(" | ")}`,
          "Escreva a CONCLUSAO curta (2-3 frases) do seu dominio. Nao liste o plano inteiro.",
        ].join("\n"),
      },
    ];
    const completion = await this.llm.complete(messages);
    return completion.content.trim();
  }
}

export function buildSpecialistSystemPrompt(blocks: {
  readonly identity: string;
  readonly mission: string;
  readonly thinking: string;
  readonly limits: string;
}): string {
  return [
    `## Identidade\n${blocks.identity}`,
    `## Missao\n${blocks.mission}`,
    `## Forma de pensar\n${blocks.thinking}`,
    `## Limites\n${blocks.limits}`,
  ].join("\n\n");
}
