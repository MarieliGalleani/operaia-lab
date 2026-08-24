import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import type { EmployeeBriefing, EmployeeTask } from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import { defaultToolPermissionPolicy } from "@operaia/tool-runtime";
import { describe, expect, it } from "vitest";
import { createMercurio, mercurioProfile } from "./index.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  constructor(
    private readonly content = "Marketing inspecionado a partir da evidence READ-ONLY.",
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
      title: "Inspecionar docs de marketing no repositorio",
      status: TaskStatus.TODO,
    },
  ];
  return {
    objective: "Auditar posicionamento e narrativa a partir do repo",
    project: "operaia-lab",
    executiveSummary: "Resumo",
    currentState: "Estado atual",
    pending: ["Inspecionar marketing"],
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
  let repoCalls = 0;
  let listCalls = 0;
  let fileCalls = 0;

  return {
    calls: () => ({ repoCalls, listCalls, fileCalls }),
    toolContext: {
      workspaceId,
      canUse(toolId: string) {
        return (
          toolId === "readRepository" ||
          toolId === "listDirectory" ||
          toolId === "readFile" ||
          toolId === "searchFiles"
        );
      },
      async readRepository() {
        repoCalls += 1;
        return {
          ok: true as const,
          data: {
            repository: "marieligalleani/operaia-lab",
            owner: "marieligalleani",
            name: "operaia-lab",
            defaultBranch: "lab",
            description: "lab",
            primaryLanguage: "TypeScript",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
        };
      },
      async listDirectory(input?: { path?: string }) {
        listCalls += 1;
        const path = input?.path ?? "";
        if (
          path === "marketing" ||
          path === "landing" ||
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
            content: "# OperaIA.lab\nMarketing e crescimento.",
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

describe("Mercurio P0.2H-POST.6 Marketing governed contract", () => {
  it("perfil mercurio permanece registrado com id mercurio", () => {
    expect(mercurioProfile.id).toBe("mercurio");
    expect(mercurioProfile.role).toBe("Marketing Lead");
  });

  it("produz EmployeeDelivery marketing_analysis DELIVERED com evidence sanitizada", async () => {
    const stub = okToolContext("operaia-lab");
    const mercurio = createMercurio(new StubLLM());
    const output = await mercurio.work({
      briefing: briefingWithTools(stub.toolContext),
    });

    expect(stub.calls().repoCalls).toBe(1);
    expect(stub.calls().listCalls).toBeGreaterThanOrEqual(1);
    expect(stub.calls().fileCalls).toBe(1);

    expect(output.decision.delivery?.employeeId).toBe("mercurio");
    expect(output.decision.delivery?.type).toBe("marketing_analysis");
    expect(output.decision.delivery?.status).toBe("DELIVERED");
    expect(output.decision.delivery?.evidence.length).toBeGreaterThanOrEqual(3);
    expect(
      output.decision.delivery?.evidence.every(
        (item) =>
          !("error" in item.data) &&
          item.data.domain === "marketing_artifacts" &&
          item.data.workspaceId === "operaia-lab" &&
          !("content" in item.data),
      ),
    ).toBe(true);
  });

  it("FAILED quando ToolContext ausente", async () => {
    const mercurio = createMercurio(new StubLLM());
    const output = await mercurio.work({
      briefing: briefingWithTools(null),
    });
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(output.decision.delivery?.type).toBe("marketing_analysis");
  });

  it("FAILED quando workspaceId ausente no ToolContext", async () => {
    const stub = okToolContext("operaia-lab");
    const { workspaceId: _omit, ...withoutWs } = stub.toolContext;
    void _omit;
    const mercurio = createMercurio(new StubLLM());
    const output = await mercurio.work({
      briefing: briefingWithTools(withoutWs),
    });
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(output.decision.delivery?.evidence[0]?.data.error).toBe(
      "WORKSPACE_REQUIRED",
    );
  });

  it("tools permitidas na policy; logs/infra DENIED", () => {
    const policy = defaultToolPermissionPolicy;
    expect(policy.isAllowed("mercurio", "readRepository")).toBe(true);
    expect(policy.isAllowed("mercurio", "listDirectory")).toBe(true);
    expect(policy.isAllowed("mercurio", "readFile")).toBe(true);
    expect(policy.isAllowed("mercurio", "searchFiles")).toBe(true);
    expect(policy.isAllowed("mercurio", "readLogs")).toBe(false);
    expect(policy.isAllowed("mercurio", "listInfrastructure")).toBe(false);
    expect(policy.isAllowed("mercurio", "readCaddy")).toBe(false);
  });
});
