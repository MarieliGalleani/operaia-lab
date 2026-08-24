import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import type { EmployeeBriefing, EmployeeTask } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { defaultActionPolicy } from "@operaia/action-runtime";
import { defaultToolPermissionPolicy } from "@operaia/tool-runtime";
import { describe, expect, it } from "vitest";
import { createNexus, nexusProfile } from "./index.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  constructor(
    private readonly content = "Produto inspecionado a partir da evidence READ-ONLY.",
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
      title: "Inspecionar roadmap e docs de produto",
      status: TaskStatus.TODO,
    },
  ];
  return {
    objective: "Auditar priorizacao e outcomes a partir de docs",
    project: "operaia-lab",
    executiveSummary: "Resumo",
    currentState: "Estado atual",
    pending: ["Inspecionar produto"],
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
        if (path === "product" || path === "roadmap" || path === "docs") {
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
            content: "# OperaIA.lab\nRoadmap e gestao de produto.",
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

describe("Nexus P0.2H-POST.7 Product governed contract", () => {
  it("perfil nexus permanece registrado com id nexus", () => {
    expect(nexusProfile.id).toBe("nexus");
    expect(nexusProfile.role).toBe("Product Manager");
  });

  it("produz EmployeeDelivery product_analysis DELIVERED com evidence sanitizada", async () => {
    const stub = okToolContext("operaia-lab");
    const nexus = createNexus(new StubLLM());
    const output = await nexus.work({
      briefing: briefingWithTools(stub.toolContext),
    });

    expect(stub.calls().listCalls).toBeGreaterThanOrEqual(1);
    expect(stub.calls().fileCalls).toBe(1);

    expect(output.decision.delivery?.employeeId).toBe("nexus");
    expect(output.decision.delivery?.type).toBe("product_analysis");
    expect(output.decision.delivery?.status).toBe("DELIVERED");
    expect(output.decision.delivery?.evidence.length).toBeGreaterThanOrEqual(2);
    expect(
      output.decision.delivery?.evidence.every(
        (item) =>
          !("error" in item.data) &&
          item.data.domain === "product_artifacts" &&
          item.data.workspaceId === "operaia-lab" &&
          !("content" in item.data) &&
          !("body" in item.data) &&
          !("fullContent" in item.data),
      ),
    ).toBe(true);
  });

  it("FAILED quando ToolContext ausente", async () => {
    const nexus = createNexus(new StubLLM());
    const output = await nexus.work({
      briefing: briefingWithTools(null),
    });
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(output.decision.delivery?.type).toBe("product_analysis");
  });

  it("FAILED quando workspaceId ausente no ToolContext", async () => {
    const stub = okToolContext("operaia-lab");
    const { workspaceId: _omit, ...withoutWs } = stub.toolContext;
    void _omit;
    const nexus = createNexus(new StubLLM());
    const output = await nexus.work({
      briefing: briefingWithTools(withoutWs),
    });
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(output.decision.delivery?.evidence[0]?.data.error).toBe(
      "WORKSPACE_REQUIRED",
    );
  });

  it("tools RoadmapDocs permitidas; readRepository/logs/infra DENIED", () => {
    const policy = defaultToolPermissionPolicy;
    expect(policy.isAllowed("nexus", "listDirectory")).toBe(true);
    expect(policy.isAllowed("nexus", "readFile")).toBe(true);
    expect(policy.isAllowed("nexus", "searchFiles")).toBe(true);
    expect(policy.isAllowed("nexus", "readRepository")).toBe(false);
    expect(policy.isAllowed("nexus", "readLogs")).toBe(false);
    expect(policy.isAllowed("nexus", "listInfrastructure")).toBe(false);
    expect(policy.isAllowed("nexus", "readCaddy")).toBe(false);
    expect(policy.isAllowed("nexus", "readCommit")).toBe(false);
  });

  it("ActionRuntime Nexus permanece vazio", () => {
    expect(defaultActionPolicy.allowedActions("nexus")).toEqual([]);
  });
});
