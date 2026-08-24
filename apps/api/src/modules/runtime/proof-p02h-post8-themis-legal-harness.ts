/**
 * P0.2H-POST.8 — harness READ-ONLY Themis Legal
 * (EmployeeRunner → delivery → governance).
 *
 * Nao enfileira Mission no banco. WorkspaceId chega via ToolContext.withWorkspaceId
 * (mesmo mecanismo do EmployeeRunner), sem Object.assign.
 *
 * Uso (local):
 *   pnpm --filter @operaia/api exec tsx --env-file-if-exists=../../.env \
 *     src/modules/runtime/proof-p02h-post8-themis-legal-harness.ts
 *
 * Tools: Documents (listDirectory/readFile/searchFiles) — sem readRepository.
 * Nao executar mutacoes / deploy / restart.
 */
import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import { createThemis } from "@operaia/employee-themis";
import { EmployeeRunner } from "@operaia/employee-runtime";
import type { WorkspaceSnapshot } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import {
  isValidLegalAnalysisDelivery,
  type LegalToolExecutionLike,
} from "@operaia/specialist-kit/legal-delivery-validation.js";
import {
  ToolContext,
  ToolId,
  defaultToolPermissionPolicy,
} from "@operaia/tool-runtime";
import { isValidDelivery } from "./work-governance/valid-result.js";

const WORKSPACE_ID = "operaia-lab";
const EMPLOYEE_ID = "themis";

class StubLLM implements LLMProvider {
  readonly name = "stub-themis-legal";
  async complete(_messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    return {
      content: "Superficie Legal inspecionada a partir da evidence READ-ONLY.",
      model: "stub",
    };
  }
}

function buildWorkspace(): WorkspaceSnapshot {
  return {
    workspaceId: WORKSPACE_ID,
    name: "OperaIA.lab",
    objective: "Auditar Legal/compliance do workspace bound",
    tasks: [
      {
        id: "leg-1",
        title: "Inspecionar superficie Legal READ-ONLY",
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
      [ToolId.listDirectory]: {
        async execute(input: { path?: string } = {}) {
          const path = input.path ?? "";
          if (
            path === "docs" ||
            path === "legal" ||
            path === "compliance" ||
            path === "contracts" ||
            path === "policies" ||
            path === "terms"
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
              content: "# OperaIA.lab\nLegal surface for harness.",
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
              query: "lgpd",
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
  const result = await runner.run(createThemis(new StubLLM()), {
    workspace: buildWorkspace(),
    objective: "Analise a estrutura Legal deste workspace (READ-ONLY).",
    tools,
  });

  const briefingTools = result.briefing.additional.toolContext as
    | { workspaceId?: string }
    | undefined;
  const delivery = result.output.decision.delivery;
  const toolExecutions = (result.output.decision.toolExecutions ??
    []) as LegalToolExecutionLike[];
  const resultJson = {
    delivery,
    toolExecutions,
  };

  const report = {
    proof: "p02h-post8-themis-legal-harness",
    workspaceId: WORKSPACE_ID,
    briefingWorkspaceId: briefingTools?.workspaceId ?? null,
    employeeId: result.employeeId,
    deliveryType: delivery?.type ?? null,
    finalStatus: delivery?.status ?? null,
    governanceValid: isValidDelivery(delivery, "legal", resultJson),
    isValidDelivery: isValidLegalAnalysisDelivery(delivery, toolExecutions),
    evidenceValid: (delivery?.evidence ?? []).every(
      (item) =>
        item.data.domain === "legal_artifacts" &&
        item.data.workspaceId === WORKSPACE_ID &&
        !("content" in item.data),
    ),
    mandatoryToolsSuccess: toolExecutions
      .filter((item) => ["listDirectory", "readFile"].includes(item.toolId))
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
