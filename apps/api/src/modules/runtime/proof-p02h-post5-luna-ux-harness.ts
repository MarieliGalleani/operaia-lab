/**
 * P0.2H-POST.5 — harness READ-ONLY Luna UX (EmployeeRunner → delivery → governance).
 *
 * Nao enfileira Mission no banco. WorkspaceId chega via ToolContext.withWorkspaceId
 * (mesmo mecanismo do EmployeeRunner), sem Object.assign.
 *
 * Uso (local):
 *   pnpm --filter @operaia/api exec tsx --env-file-if-exists=../../.env \
 *     src/modules/runtime/proof-p02h-post5-luna-ux-harness.ts
 *
 * Nao executar mutacoes / deploy / restart.
 */
import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import { createLuna } from "@operaia/employee-luna";
import { EmployeeRunner } from "@operaia/employee-runtime";
import type { WorkspaceSnapshot } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import {
  isValidUxAnalysisDelivery,
  type UxToolExecutionLike,
} from "@operaia/specialist-kit/ux-delivery-validation.js";
import {
  ToolContext,
  ToolId,
  defaultToolPermissionPolicy,
} from "@operaia/tool-runtime";
import { isValidDelivery } from "./work-governance/valid-result.js";

const WORKSPACE_ID = "operaia-lab";
const EMPLOYEE_ID = "luna";

class StubLLM implements LLMProvider {
  readonly name = "stub-luna-ux";
  async complete(_messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    return {
      content: "Superficie UX inspecionada a partir da evidence READ-ONLY.",
      model: "stub",
    };
  }
}

function buildWorkspace(): WorkspaceSnapshot {
  return {
    workspaceId: WORKSPACE_ID,
    name: "OperaIA.lab",
    objective: "Auditar UX do workspace bound",
    tasks: [
      {
        id: "ux-1",
        title: "Inspecionar superficie UX READ-ONLY",
        status: TaskStatus.TODO,
      },
    ],
  };
}

function buildTools(): ToolContext {
  const allowed = defaultToolPermissionPolicy.allowedTools(EMPLOYEE_ID);
  // ToolContext sem workspaceId — EmployeeRunner.withWorkspaceId injeta.
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
          if (path === "docs" || path === "apps" || path === "packages") {
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
                  name: "apps",
                  path: "apps",
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
              content: "# OperaIA.lab\nUX surface for harness.",
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
              query: "ux",
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
  const result = await runner.run(createLuna(new StubLLM()), {
    workspace: buildWorkspace(),
    objective: "Analise a estrutura UX/UI deste workspace (READ-ONLY).",
    tools,
  });

  const briefingTools = result.briefing.additional.toolContext as
    | { workspaceId?: string }
    | undefined;
  const delivery = result.output.decision.delivery;
  const toolExecutions = (result.output.decision.toolExecutions ??
    []) as UxToolExecutionLike[];
  const resultJson = {
    delivery,
    toolExecutions,
  };

  const report = {
    proof: "p02h-post5-luna-ux-harness",
    workspaceId: WORKSPACE_ID,
    briefingWorkspaceId: briefingTools?.workspaceId ?? null,
    employeeId: result.employeeId,
    deliveryType: delivery?.type ?? null,
    finalStatus: delivery?.status ?? null,
    governanceValid: isValidDelivery(delivery, "ux", resultJson),
    isValidDelivery: isValidUxAnalysisDelivery(delivery, toolExecutions),
    evidenceValid: (delivery?.evidence ?? []).every(
      (item) =>
        item.data.domain === "ux_artifacts" &&
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
