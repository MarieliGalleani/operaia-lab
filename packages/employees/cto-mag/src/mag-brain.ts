import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import type {
  EmployeeBrain,
  EmployeeBriefing,
  EmployeeDecision,
  EmployeeTask,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { buildMagSystemPrompt } from "./mag-system-rules.js";

const TOP_ACTIONS = 4;

/** Passos canonicos de um plano de implementacao tecnico. */
const IMPLEMENTATION_STEPS = [
  "Revisar a arquitetura atual e os pontos de acoplamento.",
  "Quebrar o objetivo em tarefas tecnicas pequenas e testaveis.",
  "Definir dependencias e a ordem de implementacao.",
  "Implementar incrementalmente com testes automatizados.",
  "Revisar codigo e validar qualidade antes de concluir.",
] as const;

export interface MagBrainDependencies {
  readonly llm: LLMProvider;
}

/**
 * Cerebro da CTO Mag.
 *
 * Retorno padronizado (via EmployeeDecision → EmployeeReport):
 * - analise (`analyzed` + `reasoning`)
 * - conclusao (`decision`)
 * - acoes propostas (`recommendations` → plan no report)
 * - proximos passos (`nextActions`)
 *
 * LLM produz apenas a conclusao narrativa; estrutura e deterministica.
 */
export class MagBrain implements EmployeeBrain {
  private readonly llm: LLMProvider;

  constructor(deps: MagBrainDependencies) {
    this.llm = deps.llm;
  }

  async decide(briefing: EmployeeBriefing): Promise<EmployeeDecision> {
    const tasks = briefing.tasks;
    const pending = tasks.filter((task) => task.status !== TaskStatus.DONE);
    const blocked = tasks.filter((task) => task.status === TaskStatus.BLOCKED);
    const withDeps = pending.filter(
      (task) => (task.dependsOn?.length ?? 0) > 0,
    );

    const proposedActions = this.buildProposedActions(pending);
    const risks = this.identifyRisks(blocked, withDeps);
    const nextSteps = this.buildNextSteps(pending, withDeps);
    const analysis = this.buildAnalysis(briefing, pending, withDeps, blocked);
    const conclusion = await this.generateConclusion(
      briefing,
      pending,
      withDeps,
      proposedActions,
    );

    return {
      analyzed: analysis,
      decision: conclusion,
      reasoning:
        "Contrato do especialista: analise → conclusao → acoes propostas → proximos passos.",
      recommendations: proposedActions,
      delegations: [],
      risks,
      nextActions: nextSteps,
    };
  }

  /** Analise tecnica estruturada (sem LLM). */
  private buildAnalysis(
    briefing: EmployeeBriefing,
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
    blocked: readonly EmployeeTask[],
  ): string {
    return (
      `Analise tecnica de ${briefing.project} para "${briefing.objective}": ` +
      `${pending.length} tarefa(s) em aberto, ${withDeps.length} com dependencias, ` +
      `${blocked.length} bloqueada(s). ` +
      `Pendencias: ${briefing.pending.join(", ") || "(nenhuma)"}.`
    );
  }

  /** Acoes propostas = plano de implementacao. */
  private buildProposedActions(pending: readonly EmployeeTask[]): string[] {
    if (pending.length === 0) {
      return [
        "Nenhuma tarefa tecnica pendente: consolidar testes e documentacao tecnica.",
      ];
    }
    return IMPLEMENTATION_STEPS.map(
      (step, index) => `${index + 1}. ${step}`,
    );
  }

  /** Riscos tecnicos derivados de bloqueios e cadeias de dependencia. */
  private identifyRisks(
    blocked: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
  ): string[] {
    const risks: string[] = [];
    for (const task of blocked) {
      risks.push(`Tarefa bloqueada trava a entrega: "${task.title}".`);
    }
    for (const task of withDeps) {
      risks.push(
        `"${task.title}" depende de ${task.dependsOn?.join(", ")}; ` +
          "ordenar antes de implementar.",
      );
    }
    if (risks.length === 0) {
      risks.push("Sem riscos tecnicos relevantes; manter cobertura de testes.");
    }
    return risks;
  }

  /** Proximos passos concretos: tarefas sem dependencias primeiro. */
  private buildNextSteps(
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
  ): string[] {
    const blockedIds = new Set(withDeps.map((task) => task.id));
    const ready = pending.filter((task) => !blockedIds.has(task.id));
    const ordered = [...ready, ...withDeps];
    return ordered
      .slice(0, TOP_ACTIONS)
      .map((task) => `Implementar: ${task.title}`);
  }

  /** Conclusao narrativa via LLM (unica chamada do especialista). */
  private async generateConclusion(
    briefing: EmployeeBriefing,
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
    proposedActions: readonly string[],
  ): Promise<string> {
    const messages: LLMMessage[] = [
      { role: "system", content: buildMagSystemPrompt() },
      {
        role: "user",
        content: [
          `Objetivo tecnico: ${briefing.objective}`,
          `Projeto: ${briefing.project}`,
          `Tarefas tecnicas em aberto: ${pending.length}`,
          `Tarefas com dependencias: ${withDeps.length}`,
          `Acoes propostas: ${proposedActions.join(" | ")}`,
          "Escreva a CONCLUSAO tecnica curta (2-3 frases): leitura de arquitetura",
          "e abordagem de implementacao. Nao liste o plano inteiro de novo.",
        ].join("\n"),
      },
    ];

    const completion = await this.llm.complete(messages);
    return completion.content.trim();
  }
}
