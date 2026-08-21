import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import type {
  EmployeeBrain,
  EmployeeBriefing,
  EmployeeDecision,
  EmployeeDelivery,
  EmployeeDeliveryEvidence,
  EmployeeDeliveryType,
  EmployeeTask,
  EmployeeToolExecution,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";

const TOP_ACTIONS = 4;
const BRIEFING_TOOL_CONTEXT_KEY = "toolContext";

/** Tools READ-ONLY permitidas no contrato de inspecao (nunca actions mutadoras). */
export const SPECIALIST_READ_ONLY_TOOL_IDS = [
  "listInfrastructure",
  "readDockerCompose",
  "readDockerfile",
  "readCaddy",
  "readLogs",
  "readWorkflow",
  "readFile",
  "listDirectory",
  "searchFiles",
  "readRepository",
] as const;

export type SpecialistReadOnlyToolId =
  (typeof SPECIALIST_READ_ONLY_TOOL_IDS)[number];

export interface SpecialistDomainConfig {
  readonly domainLabel: string;
  readonly proposedActions: readonly string[];
  readonly systemPrompt: string;
  /**
   * Quando definido, o brain tenta inspecao READ-ONLY e emite EmployeeDelivery.
   * Sem isto, permanece no comportamento legado (somente texto).
   */
  readonly employeeId?: string;
  readonly deliveryType?: EmployeeDeliveryType;
  /** Subconjunto READ-ONLY a tentar, na ordem (policy ainda restringe). */
  readonly readOnlyInspectionTools?: readonly SpecialistReadOnlyToolId[];
}

type ToolOk<T> = { readonly ok: true; readonly data: T };
type ToolErr = {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string };
};
type ToolCallResult<T> = ToolOk<T> | ToolErr;

/**
 * Subconjunto minimo de ToolContext — evita dependencia circular em tool-runtime.
 * Actions (docker.restart etc.) NAO entram neste contrato.
 */
interface SpecialistToolContext {
  canUse(toolId: string): boolean;
  listInfrastructure?(
    input?: Record<string, never>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  readDockerCompose?(
    input?: Record<string, unknown>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  readDockerfile?(
    input?: Record<string, unknown>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  readCaddy?(
    input?: Record<string, unknown>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  readLogs?(
    input?: Record<string, unknown>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  readWorkflow?(
    input?: Record<string, unknown>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  readFile?(
    input?: Record<string, unknown>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  listDirectory?(
    input?: Record<string, unknown>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  searchFiles?(
    input?: Record<string, unknown>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
  readRepository?(
    input?: Record<string, never>,
  ): Promise<ToolCallResult<Readonly<Record<string, unknown>>>>;
}

interface SpecialistInspection {
  readonly toolExecutions: readonly EmployeeToolExecution[];
  readonly evidence: readonly EmployeeDeliveryEvidence[];
  readonly allSucceeded: boolean;
  readonly attempted: boolean;
}

/**
 * Brain generico de especialista.
 *
 * Contrato P0.2B:
 * contexto → tools READ-ONLY autorizadas → evidence → EmployeeDelivery → handoff
 *
 * Sem deliveryType/employeeId: comportamento legado (analise textual).
 * Nunca invoca ActionRuntime / mutacoes.
 */
export class SpecialistBrain implements EmployeeBrain {
  private readonly llm: LLMProvider;
  private readonly config: SpecialistDomainConfig;

  constructor(llm: LLMProvider, config: SpecialistDomainConfig) {
    this.llm = llm;
    this.config = config;
  }

  async decide(briefing: EmployeeBriefing): Promise<EmployeeDecision> {
    const pending = briefing.tasks.filter(
      (task) => task.status !== TaskStatus.DONE,
    );
    const blocked = briefing.tasks.filter(
      (task) => task.status === TaskStatus.BLOCKED,
    );
    const withDeps = pending.filter((task) => (task.dependsOn?.length ?? 0) > 0);

    const proposedActions =
      pending.length === 0
        ? [
            `Nenhuma tarefa pendente em ${this.config.domainLabel}: consolidar entregas e documentacao.`,
          ]
        : this.config.proposedActions.map(
            (step, index) => `${index + 1}. ${step}`,
          );

    const inspection = await this.inspectReadOnly(briefing);
    const analysis = this.buildAnalysis(
      briefing,
      pending,
      withDeps,
      blocked,
      inspection,
    );
    const conclusion = await this.generateConclusion(
      briefing,
      pending,
      proposedActions,
      inspection,
    );
    const delivery = this.buildDelivery(
      briefing,
      inspection,
      conclusion,
      proposedActions,
    );

    return {
      analyzed: analysis,
      decision: conclusion,
      reasoning:
        "Contrato do especialista: contexto → tools READ-ONLY → evidence → delivery → handoff.",
      recommendations: proposedActions,
      delegations: [],
      risks: this.identifyRisks(blocked, withDeps, inspection),
      nextActions: this.buildNextSteps(pending, withDeps),
      ...(inspection.toolExecutions.length > 0
        ? { toolExecutions: inspection.toolExecutions }
        : {}),
      ...(delivery ? { delivery } : {}),
    };
  }

  private async inspectReadOnly(
    briefing: EmployeeBriefing,
  ): Promise<SpecialistInspection> {
    const toolIds = this.config.readOnlyInspectionTools ?? [];
    if (
      !this.config.employeeId ||
      !this.config.deliveryType ||
      toolIds.length === 0
    ) {
      return {
        toolExecutions: [],
        evidence: [],
        allSucceeded: false,
        attempted: false,
      };
    }

    const tools = readToolContext(briefing);
    if (!tools) {
      return {
        toolExecutions: [],
        evidence: [
          {
            source: "specialist_contract",
            data: {
              error: "TOOL_CONTEXT_ABSENT",
              message:
                "ToolContext ausente no briefing — inspecao READ-ONLY nao executada.",
              employeeId: this.config.employeeId,
            },
          },
        ],
        allSucceeded: false,
        attempted: true,
      };
    }

    const executions: EmployeeToolExecution[] = [];
    const evidence: EmployeeDeliveryEvidence[] = [];
    let allSucceeded = true;
    let called = 0;

    for (const toolId of toolIds) {
      if (!isReadOnlyToolId(toolId)) {
        allSucceeded = false;
        evidence.push({
          source: "specialist_contract",
          data: {
            error: "TOOL_NOT_READ_ONLY",
            message: `Tool ${toolId} bloqueada pelo contrato READ-ONLY.`,
          },
        });
        continue;
      }

      if (!tools.canUse(toolId)) {
        allSucceeded = false;
        evidence.push({
          source: toolId,
          data: {
            error: "PERMISSION_DENIED",
            message: `Employee sem permissao de policy para ${toolId}.`,
          },
        });
        continue;
      }

      const at = new Date().toISOString();
      const result = await invokeReadOnlyTool(tools, toolId);
      called += 1;
      if (result.ok) {
        executions.push({
          toolId,
          success: true,
          outcome: summarizeToolData(toolId, result.data),
          at,
        });
        evidence.push({
          source: toolId,
          data: sanitizeEvidenceData(result.data),
        });
      } else {
        allSucceeded = false;
        executions.push({
          toolId,
          success: false,
          outcome: `${result.error.code}: ${result.error.message}`,
          at,
        });
        evidence.push({
          source: toolId,
          data: {
            error: result.error.code,
            message: result.error.message,
          },
        });
      }
    }

    if (called === 0 && evidence.length === 0) {
      evidence.push({
        source: "specialist_contract",
        data: {
          error: "NO_TOOLS_INVOKED",
          message: "Nenhuma tool READ-ONLY foi invocavel sob a policy atual.",
        },
      });
      allSucceeded = false;
    }

    return {
      toolExecutions: executions,
      evidence,
      allSucceeded: allSucceeded && called > 0,
      attempted: true,
    };
  }

  private buildDelivery(
    briefing: EmployeeBriefing,
    inspection: SpecialistInspection,
    conclusion: string,
    proposedActions: readonly string[],
  ): EmployeeDelivery | null {
    if (
      !inspection.attempted ||
      !this.config.employeeId ||
      !this.config.deliveryType
    ) {
      return null;
    }
    if (inspection.evidence.length === 0) {
      return null;
    }

    const status = inspection.allSucceeded ? "DELIVERED" : "FAILED";
    const findings = this.buildFindings(inspection, conclusion);

    return {
      type: this.config.deliveryType,
      status,
      missionId: "",
      employeeId: this.config.employeeId,
      objective: briefing.objective,
      summary:
        status === "DELIVERED"
          ? conclusion
          : `Inspecao incompleta em ${this.config.domainLabel}. ${conclusion}`,
      findings,
      evidence: inspection.evidence,
      recommendations: [...proposedActions].slice(0, TOP_ACTIONS),
      deliveredAt: new Date().toISOString(),
    };
  }

  private buildFindings(
    inspection: SpecialistInspection,
    conclusion: string,
  ): string[] {
    const findings: string[] = [];
    for (const item of inspection.evidence) {
      if ("error" in item.data) {
        findings.push(
          `Tool ${item.source} falhou: ${String(item.data.error)} — ${String(item.data.message ?? "")}`,
        );
        continue;
      }
      findings.push(summarizeToolData(item.source, item.data));
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
    inspection: SpecialistInspection,
  ): string {
    const toolNote =
      inspection.toolExecutions.length > 0
        ? ` Tools: ${inspection.toolExecutions
            .map((item) => `${item.toolId}=${item.success ? "ok" : "falhou"}`)
            .join(", ")}.`
        : "";
    return (
      `Analise de ${this.config.domainLabel} em ${briefing.project} ` +
      `para "${briefing.objective}": ${pending.length} pendente(s), ` +
      `${withDeps.length} com dependencias, ${blocked.length} bloqueada(s).` +
      toolNote
    );
  }

  private identifyRisks(
    blocked: readonly EmployeeTask[],
    withDeps: readonly EmployeeTask[],
    inspection: SpecialistInspection,
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
    if (inspection.attempted && !inspection.allSucceeded) {
      risks.push("Inspecao READ-ONLY incompleta ou com falha de tool.");
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
    inspection: SpecialistInspection,
  ): Promise<string> {
    const evidenceLines = inspection.evidence
      .slice(0, 6)
      .map((item) => {
        if ("error" in item.data) {
          return `${item.source}: ERRO ${String(item.data.error)}`;
        }
        return `${item.source}: ${summarizeToolData(item.source, item.data)}`;
      })
      .join("\n");

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
          evidenceLines
            ? `Evidence READ-ONLY:\n${evidenceLines}`
            : "Evidence READ-ONLY: (nenhuma)",
          "Escreva a CONCLUSAO curta (2-3 frases) do seu dominio com base na evidence. Nao invente facts ausentes da evidence.",
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

function isReadOnlyToolId(toolId: string): toolId is SpecialistReadOnlyToolId {
  return (SPECIALIST_READ_ONLY_TOOL_IDS as readonly string[]).includes(toolId);
}

function readToolContext(briefing: EmployeeBriefing): SpecialistToolContext | null {
  const value = briefing.additional[BRIEFING_TOOL_CONTEXT_KEY];
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as SpecialistToolContext;
  if (typeof candidate.canUse !== "function") {
    return null;
  }
  return candidate;
}

async function invokeReadOnlyTool(
  tools: SpecialistToolContext,
  toolId: SpecialistReadOnlyToolId,
): Promise<ToolCallResult<Readonly<Record<string, unknown>>>> {
  try {
    switch (toolId) {
      case "listInfrastructure":
        if (!tools.listInfrastructure) {
          return missingMethod(toolId);
        }
        return tools.listInfrastructure({});
      case "readDockerCompose":
        if (!tools.readDockerCompose) {
          return missingMethod(toolId);
        }
        return tools.readDockerCompose({});
      case "readDockerfile":
        if (!tools.readDockerfile) {
          return missingMethod(toolId);
        }
        return tools.readDockerfile({});
      case "readCaddy":
        if (!tools.readCaddy) {
          return missingMethod(toolId);
        }
        return tools.readCaddy({});
      case "readLogs":
        if (!tools.readLogs) {
          return missingMethod(toolId);
        }
        return tools.readLogs({ source: "journal" });
      case "readWorkflow":
        if (!tools.readWorkflow) {
          return missingMethod(toolId);
        }
        // Adapter exige workflowIdOrPath (ex.: ci.yml sob .github/workflows).
        return tools.readWorkflow({ workflowIdOrPath: "ci.yml" });
      case "readFile":
        if (!tools.readFile) {
          return missingMethod(toolId);
        }
        return tools.readFile({ path: "README.md" });
      case "listDirectory":
        if (!tools.listDirectory) {
          return missingMethod(toolId);
        }
        return tools.listDirectory({ path: "" });
      case "searchFiles":
        if (!tools.searchFiles) {
          return missingMethod(toolId);
        }
        return tools.searchFiles({ query: "TODO" });
      case "readRepository":
        if (!tools.readRepository) {
          return missingMethod(toolId);
        }
        return tools.readRepository({});
      default: {
        const _exhaustive: never = toolId;
        return {
          ok: false,
          error: {
            code: "UNKNOWN_TOOL",
            message: `Tool nao mapeada: ${String(_exhaustive)}`,
          },
        };
      }
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "TOOL_INVOKE_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function missingMethod(toolId: string): ToolErr {
  return {
    ok: false,
    error: {
      code: "METHOD_ABSENT",
      message: `Metodo ausente no ToolContext: ${toolId}`,
    },
  };
}

function sanitizeEvidenceData(
  data: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.toLowerCase().includes("secret") || key.toLowerCase().includes("token")) {
      continue;
    }
    if (typeof value === "string" && value.length > 2000) {
      out[key] = `${value.slice(0, 2000)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function summarizeToolData(
  toolId: string,
  data: Readonly<Record<string, unknown>>,
): string {
  if ("error" in data) {
    return `${toolId} erro=${String(data.error)}`;
  }
  switch (toolId) {
    case "listInfrastructure": {
      const artifacts = data.artifacts;
      const count = Array.isArray(artifacts) ? artifacts.length : "n/a";
      return `Infra: ${String(count)} artefato(s).`;
    }
    case "readDockerCompose":
      return `Compose path=${String(data.path ?? "n/a")} bytes=${String(
        typeof data.content === "string" ? data.content.length : "n/a",
      )}.`;
    case "readDockerfile":
      return `Dockerfile path=${String(data.path ?? "n/a")}.`;
    case "readCaddy":
      return `Caddy path=${String(data.path ?? "n/a")}.`;
    case "readLogs": {
      const lines = data.lines;
      const n = Array.isArray(lines) ? lines.length : "n/a";
      return `Logs source=${String(data.source ?? "n/a")} lines=${String(n)}.`;
    }
    case "readWorkflow":
      return `Workflow id=${String(data.id ?? data.name ?? "n/a")}.`;
    case "listDirectory": {
      const entries = data.entries;
      const n = Array.isArray(entries) ? entries.length : data.entryCount;
      return `Dir path=${String(data.path ?? "")} entries=${String(n ?? "n/a")}.`;
    }
    case "readRepository":
      return `Repo ${String(data.repository ?? "n/a")} branch=${String(
        data.defaultBranch ?? "n/a",
      )}.`;
    default:
      return `${toolId}: ok`;
  }
}
