import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import type {
  EmployeeBrain,
  EmployeeBriefing,
  EmployeeDecision,
  EmployeeDelivery,
  EmployeeDeliveryEvidence,
  EmployeeTask,
  EmployeeToolExecution,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { buildMagSystemPrompt } from "./mag-system-rules.js";

const TOP_ACTIONS = 4;
const MAG_EMPLOYEE_ID = "cto-mag";
const READ_REPOSITORY_TOOL_ID = "readRepository";
const LIST_DIRECTORY_TOOL_ID = "listDirectory";

/** Passos canonicos de um plano de implementacao tecnico. */
const IMPLEMENTATION_STEPS = [
  "Revisar a arquitetura atual e os pontos de acoplamento.",
  "Quebrar o objetivo em tarefas tecnicas pequenas e testaveis.",
  "Definir dependencias e a ordem de implementacao.",
  "Implementar incrementalmente com testes automatizados.",
  "Revisar codigo e validar qualidade antes de concluir.",
] as const;

/** Subconjunto minimo de ToolContext — evita dependencia runtime circular. */
interface MagToolContext {
  canUse(toolId: string): boolean;
  readRepository(input?: Record<string, never>): Promise<MagRepoResult>;
  listDirectory(input?: {
    readonly path?: string;
  }): Promise<MagListDirResult>;
}

type MagRepoResult =
  | {
      readonly ok: true;
      readonly data: {
        readonly repository: string;
        readonly defaultBranch: string;
        readonly primaryLanguage: string | null;
        readonly updatedAt: string | null;
        readonly description?: string | null;
        readonly owner?: string;
        readonly name?: string;
      };
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

type MagListDirResult =
  | {
      readonly ok: true;
      readonly data: {
        readonly repository: string;
        readonly path: string;
        readonly entries: readonly {
          readonly name: string;
          readonly path: string;
          readonly type: string;
          readonly size: number | null;
        }[];
      };
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

interface MagInspection {
  readonly toolExecutions: readonly EmployeeToolExecution[];
  readonly evidence: readonly EmployeeDeliveryEvidence[];
  readonly allSucceeded: boolean;
}

export interface MagBrainDependencies {
  readonly llm: LLMProvider;
}

/**
 * Cerebro da CTO Mag.
 *
 * LLM produz narrativa (summary/findings/recommendations).
 * Evidencias e delivery.status vêm exclusivamente dos outcomes das tools.
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

    const inspection = await this.inspectRepositoryState(briefing);
    const proposedActions = this.buildProposedActions(pending);
    const risks = this.identifyRisks(blocked, withDeps);
    const nextSteps = this.buildNextSteps(pending, withDeps);
    const analysis = this.buildAnalysis(
      briefing,
      pending,
      withDeps,
      blocked,
      inspection.toolExecutions,
    );
    const conclusion = await this.generateConclusion(
      briefing,
      pending,
      withDeps,
      proposedActions,
      inspection,
    );
    const delivery = this.buildDelivery(
      briefing,
      inspection,
      conclusion,
      proposedActions,
      pending,
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
      ...(inspection.toolExecutions.length > 0
        ? { toolExecutions: inspection.toolExecutions }
        : {}),
      ...(delivery ? { delivery } : {}),
    };
  }

  /**
   * Invoca readRepository + listDirectory (read-only) quando disponiveis.
   * Nao inventa outcomes — falhas sao registradas com success=false.
   */
  private async inspectRepositoryState(
    briefing: EmployeeBriefing,
  ): Promise<MagInspection> {
    const tools = readToolContext(briefing);
    if (!tools) {
      return { toolExecutions: [], evidence: [], allSucceeded: false };
    }

    const executions: EmployeeToolExecution[] = [];
    const evidence: EmployeeDeliveryEvidence[] = [];
    let allSucceeded = true;

    if (tools.canUse(READ_REPOSITORY_TOOL_ID)) {
      const at = new Date().toISOString();
      const result = await tools.readRepository({});
      if (result.ok) {
        const data = result.data;
        executions.push({
          toolId: READ_REPOSITORY_TOOL_ID,
          success: true,
          outcome:
            `repository=${data.repository}` +
            ` defaultBranch=${data.defaultBranch}` +
            ` language=${data.primaryLanguage ?? "n/a"}` +
            ` updatedAt=${data.updatedAt ?? "n/a"}`,
          at,
        });
        evidence.push({
          source: READ_REPOSITORY_TOOL_ID,
          data: {
            repository: data.repository,
            defaultBranch: data.defaultBranch,
            primaryLanguage: data.primaryLanguage,
            updatedAt: data.updatedAt,
            ...(data.description !== undefined
              ? { description: data.description }
              : {}),
            ...(data.owner !== undefined ? { owner: data.owner } : {}),
            ...(data.name !== undefined ? { name: data.name } : {}),
          },
        });
      } else {
        allSucceeded = false;
        executions.push({
          toolId: READ_REPOSITORY_TOOL_ID,
          success: false,
          outcome: `${result.error.code}: ${result.error.message}`,
          at,
        });
        evidence.push({
          source: READ_REPOSITORY_TOOL_ID,
          data: {
            error: result.error.code,
            message: result.error.message,
          },
        });
      }
    } else {
      allSucceeded = false;
    }

    if (tools.canUse(LIST_DIRECTORY_TOOL_ID)) {
      const at = new Date().toISOString();
      const result = await tools.listDirectory({ path: "" });
      if (result.ok) {
        const data = result.data;
        const names = data.entries.map((entry) => entry.name);
        executions.push({
          toolId: LIST_DIRECTORY_TOOL_ID,
          success: true,
          outcome:
            `repository=${data.repository}` +
            ` path=${data.path}` +
            ` entries=${names.length}` +
            ` names=${names.slice(0, 20).join(",")}`,
          at,
        });
        evidence.push({
          source: LIST_DIRECTORY_TOOL_ID,
          data: {
            repository: data.repository,
            path: data.path,
            entryCount: data.entries.length,
            entries: data.entries.map((entry) => ({
              name: entry.name,
              path: entry.path,
              type: entry.type,
              size: entry.size,
            })),
          },
        });
      } else {
        allSucceeded = false;
        executions.push({
          toolId: LIST_DIRECTORY_TOOL_ID,
          success: false,
          outcome: `${result.error.code}: ${result.error.message}`,
          at,
        });
        evidence.push({
          source: LIST_DIRECTORY_TOOL_ID,
          data: {
            error: result.error.code,
            message: result.error.message,
          },
        });
      }
    } else {
      allSucceeded = false;
    }

    const requiredOk =
      executions.some(
        (item) => item.toolId === READ_REPOSITORY_TOOL_ID && item.success,
      ) &&
      executions.some(
        (item) => item.toolId === LIST_DIRECTORY_TOOL_ID && item.success,
      );

    return {
      toolExecutions: executions,
      evidence,
      allSucceeded: allSucceeded && requiredOk,
    };
  }

  private buildDelivery(
    briefing: EmployeeBriefing,
    inspection: MagInspection,
    conclusion: string,
    proposedActions: readonly string[],
    pending: readonly EmployeeTask[],
  ): EmployeeDelivery | null {
    if (inspection.evidence.length === 0) {
      return null;
    }

    const deliveredAt = new Date().toISOString();
    const status = inspection.allSucceeded ? "DELIVERED" : "FAILED";
    const findings = this.buildFindingsFromEvidence(
      inspection,
      pending,
      conclusion,
    );

    return {
      type: "technical_analysis",
      status,
      missionId: "",
      employeeId: MAG_EMPLOYEE_ID,
      objective: briefing.objective,
      summary:
        status === "DELIVERED"
          ? conclusion
          : `Diagnostico incompleto: falha em tool(s) obrigatoria(s). ${conclusion}`,
      findings,
      evidence: inspection.evidence,
      recommendations: [...proposedActions].slice(0, TOP_ACTIONS),
      deliveredAt,
    };
  }

  private buildFindingsFromEvidence(
    inspection: MagInspection,
    pending: readonly EmployeeTask[],
    conclusion: string,
  ): string[] {
    const findings: string[] = [];
    for (const item of inspection.evidence) {
      if (item.source === READ_REPOSITORY_TOOL_ID && !("error" in item.data)) {
        findings.push(
          `Repositorio ${String(item.data.repository)} ` +
            `(branch ${String(item.data.defaultBranch)}, ` +
            `lang ${String(item.data.primaryLanguage ?? "n/a")}).`,
        );
      }
      if (item.source === LIST_DIRECTORY_TOOL_ID && !("error" in item.data)) {
        findings.push(
          `Raiz do repo com ${String(item.data.entryCount)} entradas.`,
        );
      }
      if ("error" in item.data) {
        findings.push(
          `Tool ${item.source} falhou: ${String(item.data.error)} — ${String(item.data.message)}`,
        );
      }
    }
    if (pending.length > 0) {
      findings.push(`${pending.length} tarefa(s) tecnica(s) pendente(s) no quadro.`);
    }
    if (findings.length === 0) {
      findings.push(conclusion);
    }
    return findings;
  }

  private buildAnalysis(
    briefing: EmployeeBriefing,
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
    blocked: readonly EmployeeTask[],
    toolExecutions: readonly EmployeeToolExecution[],
  ): string {
    const toolNote =
      toolExecutions.length > 0
        ? ` Tools: ${toolExecutions
            .map(
              (item) =>
                `${item.toolId}=${item.success ? "ok" : "falhou"}`,
            )
            .join(", ")}.`
        : "";
    return (
      `Analise tecnica de ${briefing.project} para "${briefing.objective}": ` +
      `${pending.length} tarefa(s) em aberto, ${withDeps.length} com dependencias, ` +
      `${blocked.length} bloqueada(s). ` +
      `Pendencias: ${briefing.pending.join(", ") || "(nenhuma)"}.` +
      toolNote
    );
  }

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

  private async generateConclusion(
    briefing: EmployeeBriefing,
    pending: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
    proposedActions: readonly string[],
    inspection: MagInspection,
  ): Promise<string> {
    const toolLines =
      inspection.toolExecutions.length > 0
        ? inspection.toolExecutions
            .map(
              (item) =>
                `Evidencia tool ${item.toolId} (${item.success ? "ok" : "fail"}): ${item.outcome}`,
            )
            .join("\n")
        : "Sem evidencia de tool nesta execucao.";
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
          toolLines,
          "Escreva a CONCLUSAO tecnica curta (2-3 frases) com base nas evidencias acima.",
          "Nao invente nomes de repositorio, branch, arquivos ou metadados.",
          "Nao liste o plano inteiro de novo.",
        ].join("\n"),
      },
    ];

    const completion = await this.llm.complete(messages);
    return completion.content.trim();
  }
}

function readToolContext(briefing: EmployeeBriefing): MagToolContext | null {
  const value = briefing.additional.toolContext;
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as MagToolContext;
  if (
    typeof candidate.canUse !== "function" ||
    typeof candidate.readRepository !== "function" ||
    typeof candidate.listDirectory !== "function"
  ) {
    return null;
  }
  return candidate;
}
