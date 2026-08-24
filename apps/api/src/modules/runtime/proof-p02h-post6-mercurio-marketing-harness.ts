/**
 * P0.2H-POST.6 — harness READ-ONLY Mercurio Marketing
 * (EmployeeRunner → delivery → governance).
 *
 * Nao enfileira Mission no banco. WorkspaceId chega via ToolContext.withWorkspaceId
 * (mesmo mecanismo do EmployeeRunner), sem Object.assign.
 *
 * Uso (local):
 *   pnpm --filter @operaia/api exec tsx --env-file-if-exists=../../.env \
 *     src/modules/runtime/proof-p02h-post6-mercurio-marketing-harness.ts
 *
 * Nao executar mutacoes / deploy / restart.
 */
import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import { createMercurio } from "@operaia/employee-mercurio";
import { EmployeeRunner } from "@operaia/employee-runtime";
import type { WorkspaceSnapshot } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import {
  isValidMarketingAnalysisDelivery,
  type MarketingToolExecutionLike,
} from "@operaia/specialist-kit/marketing-delivery-validation.js";
import {
  ToolContext,
  ToolId,
  defaultToolPermissionPolicy,
} from "@operaia/tool-runtime";
import { isValidDelivery } from "./work-governance/valid-result.js";

const WORKSPACE_ID = "operaia-lab";
const EMPLOYEE_ID = "mercurio";

class StubLLM implements LLMProvider {
  readonly name = "stub-mercurio-marketing";
  async complete(_messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    return {
      content: "Superficie Marketing inspecionada a partir da evidence READ-ONLY.",
      model: "stub",
    };
  }
}

function buildWorkspace(): WorkspaceSnapshot {
  return {
    workspaceId: WORKSPACE_ID,
    name: "OperaIA.lab",
    objective: "Auditar Marketing do workspace bound",
    tasks: [
      {
        id: "mkt-1",
        title: "Inspecionar superficie Marketing READ-ONLY",
        status: TaskStatus.TODO,
      },
    ],
  };
}

function buildTools(): ToolContext {
  const allowed = defaultToolPermissionPolicy.allowedTools(EMPLOYEE_ID);
  return new ToolContext({
    employeeId: EMPLOYEE_ID,
    allowedTools: allowed,
    ports: {
      [ToolId.readRepository]: {
        async execute() {
          return {
            ok: true as const,
            data: {
              repository: "marieligalleani/operaia-lab",
              owner: "marieligalleani",
              name: "operaia-lab",
              defaultBranch: "lab",
              description: "lab",
              primaryLanguage: "TypeScript",
              updatedAt: new Date().toISOString(),
            },
          };
        },
      },
      [ToolId.listDirectory]: {
        async execute(input: { path?: string } = {}) {
          const path = input.path ?? "";
          if (
            path === "docs" ||
            path === "marketing" ||
            path === "landing"
          ) {
            return {
              ok: false as const,
              error: {
                code: "NOT_FOUND" as const,
                message: "optional",
                toolId: ToolId.listDirectory,
              },
            };
          }
          return {
            ok: true as const,
            data: {
              repository: "marieligalleani/operaia-lab",
              path: "",
              entries: [
                {
                  name: "README.md",
                  path: "README.md",
                  type: "file" as const,
                  size: 40,
                },
                {
                  name: "docs",
                  path: "docs",
                  type: "dir" as const,
                  size: null,
                },
              ],
            },
          };
        },
      },
      [ToolId.readFile]: {
        async execute() {
          return {
            ok: true as const,
            data: {
              repository: "marieligalleani/operaia-lab",
              path: "README.md",
              content: "# OperaIA.lab\nMarketing surface for harness.",
              encoding: "utf-8" as const,
              size: 40,
            },
          };
        },
      },
      [ToolId.searchFiles]: {
        async execute() {
          return {
            ok: true as const,
            data: {
              repository: "marieligalleani/operaia-lab",
              query: "marketing",
              hits: [],
            },
          };
        },
      },
    },
  });
}

async function main(): Promise<void> {
  const tools = buildTools();
  if (tools.workspaceId) {
    throw new Error("Harness invalido: ToolContext ja tinha workspaceId");
  }

  const runner = new EmployeeRunner();
  const result = await runner.run(createMercurio(new StubLLM()), {
    workspace: buildWorkspace(),
    objective: "Analise a estrutura Marketing deste workspace (READ-ONLY).",
    tools,
  });

  const briefingTools = result.briefing.additional.toolContext as
    | { workspaceId?: string }
    | undefined;
  const delivery = result.output.decision.delivery;
  const toolExecutions = (result.output.decision.toolExecutions ??
    []) as MarketingToolExecutionLike[];
  const resultJson = {
    delivery,
    toolExecutions,
  };

  const report = {
    proof: "p02h-post6-mercurio-marketing-harness",
    workspaceId: WORKSPACE_ID,
    briefingWorkspaceId: briefingTools?.workspaceId ?? null,
    employeeId: result.employeeId,
    deliveryType: delivery?.type ?? null,
    finalStatus: delivery?.status ?? null,
    governanceValid: isValidDelivery(delivery, "marketing", resultJson),
    isValidDelivery: isValidMarketingAnalysisDelivery(delivery, toolExecutions),
    evidenceValid: (delivery?.evidence ?? []).every(
      (item) =>
        item.data.domain === "marketing_artifacts" &&
        item.data.workspaceId === WORKSPACE_ID &&
        !("content" in item.data),
    ),
    mandatoryToolsSuccess: toolExecutions
      .filter((item) =>
        ["readRepository", "listDirectory", "readFile"].includes(item.toolId),
      )
      .every((item) => item.success),
    unexpectedToolFailures: toolExecutions.filter(
      (item) =>
        !item.success &&
        !["listDirectory", "searchFiles"].includes(item.toolId),
    ).length,
    databaseWrites: 0,
  };

  console.log(JSON.stringify(report, null, 2));
  if (
    !report.governanceValid ||
    !report.isValidDelivery ||
    report.briefingWorkspaceId !== WORKSPACE_ID ||
    report.finalStatus !== "DELIVERED"
  ) {
    process.exitCode = 1;
  }
}

void main();
