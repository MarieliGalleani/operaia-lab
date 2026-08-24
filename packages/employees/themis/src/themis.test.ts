import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import type { EmployeeBriefing, EmployeeTask } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { defaultActionPolicy } from "@operaia/action-runtime";
import { defaultToolPermissionPolicy } from "@operaia/tool-runtime";
import { describe, expect, it } from "vitest";
import { createThemis, themisProfile } from "./index.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  constructor(
    private readonly content = "Compliance inspecionado a partir da evidence READ-ONLY.",
  ) {}
  async complete(_messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    return { content: this.content, model: "stub" };
  }
}

function briefingWithTools(
  tools: Record<string, unknown> | null,
): EmployeeBriefing {
  const tasks: EmployeeTask[] = [
    {
      id: "t1",
      title: "Inspecionar documentos de compliance",
      status: TaskStatus.TODO,
    },
  ];
  return {
    objective: "Auditar riscos juridicos a partir de documentos",
    project: "operaia-lab",
    executiveSummary: "Resumo",
    currentState: "Estado atual",
    pending: ["Inspecionar compliance"],
    documentation: [],
    history: [],
    constraints: [],
    successCriteria: ["Evidence READ-ONLY"],
    tasks,
    additional: tools
      ? {
          toolContext: tools,
        }
      : {},
  };
}

function okToolContext(workspaceId: string) {
  let listCalls = 0;
  let fileCalls = 0;

  return {
    calls: () => ({ listCalls, fileCalls }),
    toolContext: {
      workspaceId,
      canUse(toolId: string) {
        return (
          toolId === "listDirectory" ||
          toolId === "readFile" ||
          toolId === "searchFiles"
        );
      },
      async listDirectory(input?: { path?: string }) {
        listCalls += 1;
        const path = input?.path ?? "";
        if (
          path === "legal" ||
          path === "compliance" ||
          path === "contracts" ||
          path === "policies" ||
          path === "terms" ||
          path === "docs"
        ) {
          return {
            ok: false as const,
            error: { code: "NOT_FOUND", message: "optional root absent" },
          };
        }
        return {
          ok: true as const,
          data: {
            path: "",
            entries: [
              { name: "docs", type: "dir" },
              { name: "README.md", type: "file" },
            ],
          },
        };
      },
      async readFile() {
        fileCalls += 1;
        return {
          ok: true as const,
          data: {
            path: "README.md",
            content: "# OperaIA.lab\nPoliticas e conformidade LGPD.",
          },
        };
      },
      async searchFiles() {
        return {
          ok: true as const,
          data: { matches: [] },
        };
      },
      async writeFile() {
        return {
          ok: false as const,
          error: { code: "FORBIDDEN", message: "mutation" },
        };
      },
    },
  };
}

describe("Themis P0.2H-POST.8 Legal governed contract", () => {
  it("perfil themis permanece registrado com id themis", () => {
    expect(themisProfile.id).toBe("themis");
    expect(themisProfile.role).toBe("Legal Counsel");
  });

  it("produz EmployeeDelivery legal_analysis DELIVERED com evidence sanitizada", async () => {
    const stub = okToolContext("operaia-lab");
    const themis = createThemis(new StubLLM());
    const output = await themis.work({
      briefing: briefingWithTools(stub.toolContext),
    });

    expect(stub.calls().listCalls).toBeGreaterThanOrEqual(1);
    expect(stub.calls().fileCalls).toBe(1);

    expect(output.decision.delivery?.employeeId).toBe("themis");
    expect(output.decision.delivery?.type).toBe("legal_analysis");
    expect(output.decision.delivery?.status).toBe("DELIVERED");
    expect(output.decision.delivery?.evidence.length).toBeGreaterThanOrEqual(2);
    expect(
      output.decision.delivery?.evidence.every(
        (item) =>
          !("error" in item.data) &&
          item.data.domain === "legal_artifacts" &&
          item.data.workspaceId === "operaia-lab" &&
          !("content" in item.data) &&
          !("body" in item.data) &&
          !("fullContent" in item.data),
      ),
    ).toBe(true);
  });

  it("FAILED quando ToolContext ausente", async () => {
    const themis = createThemis(new StubLLM());
    const output = await themis.work({
      briefing: briefingWithTools(null),
    });
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(output.decision.delivery?.type).toBe("legal_analysis");
  });

  it("FAILED quando workspaceId ausente no ToolContext", async () => {
    const stub = okToolContext("operaia-lab");
    const { workspaceId: _omit, ...withoutWs } = stub.toolContext;
    void _omit;
    const themis = createThemis(new StubLLM());
    const output = await themis.work({
      briefing: briefingWithTools(withoutWs),
    });
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(output.decision.delivery?.evidence[0]?.data.error).toBe(
      "WORKSPACE_REQUIRED",
    );
  });

  it("tools Documents permitidas; readRepository/logs/infra DENIED", () => {
    const policy = defaultToolPermissionPolicy;
    expect(policy.isAllowed("themis", "listDirectory")).toBe(true);
    expect(policy.isAllowed("themis", "readFile")).toBe(true);
    expect(policy.isAllowed("themis", "searchFiles")).toBe(true);
    expect(policy.isAllowed("themis", "readRepository")).toBe(false);
    expect(policy.isAllowed("themis", "readLogs")).toBe(false);
    expect(policy.isAllowed("themis", "listInfrastructure")).toBe(false);
    expect(policy.isAllowed("themis", "readCaddy")).toBe(false);
    expect(policy.isAllowed("themis", "readCommit")).toBe(false);
  });

  it("ActionRuntime Themis permanece vazio", () => {
    expect(defaultActionPolicy.allowedActions("themis")).toEqual([]);
  });
});
