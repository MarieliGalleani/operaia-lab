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
 * Cerebro da CTO Mag como especializacao do Employee Framework.
 *
 * A analise tecnica e deterministica (derivada do briefing); o LLM produz
 * apenas a narrativa da analise. Mesma filosofia do CEO, expressa no contrato
 * comum (EmployeeDecision).
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

    const plan = this.buildImplementationPlan(pending);
    const risks = this.identifyRisks(blocked, withDeps);
    const narrative = await this.generateAnalysis(briefing, pending, withDeps);

    return {
      analyzed:
        `Analise tecnica de ${briefing.project}: ${pending.length} tarefa(s) ` +
        `tecnica(s) em aberto, ${withDeps.length} com dependencias e ` +
        `${blocked.length} bloqueada(s).`,
      decision: narrative,
      reasoning:
        "Decomposicao tecnica priorizando dependencias e reducao de risco, " +
        "com qualidade e testes desde o inicio.",
      recommendations: plan,
      delegations: [],
      risks,
      nextActions: this.buildNextActions(pending, withDeps),
    };
  }

  /** Plano de implementacao: passos canonicos adaptados ao volume de trabalho. */
  private buildImplementationPlan(pending: readonly EmployeeTask[]): string[] {
    if (pending.length === 0) {
      return [
        "Nenhuma tarefa tecnica pendente: consolidar testes e documentacao tecnica.",
      ];
    }
    return IMPLEMENTATION_STEPS.map((step, index) => `${index + 1}. ${step}`);
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

  /** Proximas acoes concretas: tarefas sem dependencias primeiro. */
  private buildNextActions(
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
  ): string[] {
    const blockedIds = new Set(withDeps.map((task) => task.id));
    const ready = pending.filter((task) => !blockedIds.has(task.id));
    const ordered = [...ready, ...withDeps];
    return ordered.slice(0, TOP_ACTIONS).map((task) => `Implementar: ${task.title}`);
  }

  private async generateAnalysis(
    briefing: EmployeeBriefing,
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
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
          `Pendencias: ${briefing.pending.join(", ") || "(nenhuma)"}`,
          "Escreva uma analise tecnica curta (2-3 frases) com a leitura de " +
            "arquitetura e a abordagem de implementacao.",
        ].join("\n"),
      },
    ];

    const completion = await this.llm.complete(messages);
    return completion.content.trim();
  }
}
