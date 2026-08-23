import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import type { EmployeeBriefing, EmployeeTask } from "@operaia/employee-framework";
import {
  isValidFinancialAnalysisDelivery,
} from "@operaia/specialist-kit/finance-delivery-validation.js";
import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { createAurora, auroraProfile } from "./index.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  constructor(
    private readonly content = "Conclusao financeira baseada na evidence READ-ONLY.",
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
      title: "Inspecionar artefatos financeiros",
      status: TaskStatus.TODO,
    },
  ];
  return {
    objective: "Auditar saude financeira",
    project: "operaia-lab",
    executiveSummary: "Resumo",
    currentState: "Estado atual",
    pending: ["Inspecionar finance"],
    documentation: [],
    history: [],
    constraints: [],
    successCriteria: ["Evidence READ-ONLY"],
    tasks,
    additional: tools ? { toolContext: tools } : {},
  };
}

function okFinanceToolContext() {
  const mutating = { readRepository: 0, writeFile: 0 };
  return {
    mutating,
    toolContext: {
      workspaceId: "operaia-lab",
      canUse(toolId: string) {
        return (
          toolId === "listDirectory" ||
          toolId === "readFile" ||
          toolId === "searchFiles"
        );
      },
      async listDirectory(input: Record<string, unknown>) {
        const path = String(input.path ?? "");
        if (path === "finance" || path === "billing") {
          return {
            ok: true as const,
            data: {
              repository: "marieligalleani/operaia-lab",
              path,
              entries: [{ name: "overview.md", type: "file" }],
            },
          };
        }
        return {
          ok: false as const,
          error: { code: "PATH_FORBIDDEN", message: "blocked" },
        };
      },
      async readFile(input: Record<string, unknown>) {
        const path = String(input.path ?? "");
        if (path === "finance/overview.md") {
          return {
            ok: true as const,
            data: {
              repository: "marieligalleani/operaia-lab",
              path,
              content: `---
schemaVersion: 1
runwayMonths: 12
monthlyBurn: 85000
monthlyRevenue: 120000
riskLevel: medium
---
# Overview`,
            },
          };
        }
        return {
          ok: false as const,
          error: { code: "NOT_FOUND", message: "missing optional" },
        };
      },
      async searchFiles(input: Record<string, unknown>) {
        return {
          ok: true as const,
          data: {
            repository: "marieligalleani/operaia-lab",
            query: input.query,
            pathPrefix: input.pathPrefix,
            hits: [{ path: "finance/overview.md" }],
          },
        };
      },
      async readRepository() {
        mutating.readRepository += 1;
        return { ok: true as const, data: { repository: "blocked" } };
      },
      async writeFile() {
        mutating.writeFile += 1;
        return {
          ok: false as const,
          error: { code: "FORBIDDEN", message: "mutation" },
        };
      },
    },
  };
}

describe("Aurora P0.2H-5L financial_analysis activation", () => {
  it("perfil aurora permanece registrado com id aurora", () => {
    expect(auroraProfile.id).toBe("aurora");
    expect(auroraProfile.role).toBe("Finance Lead");
  });

  it("produz EmployeeDelivery financial_analysis DELIVERED com evidence financeira", async () => {
    const stub = okFinanceToolContext();
    const aurora = createAurora(new StubLLM());
    const output = await aurora.work({
      briefing: briefingWithTools(stub.toolContext),
    });

    expect(stub.mutating.readRepository).toBe(0);
    expect(stub.mutating.writeFile).toBe(0);
    expect(output.decision.delivery?.employeeId).toBe("aurora");
    expect(output.decision.delivery?.type).toBe("financial_analysis");
    expect(output.decision.delivery?.status).toBe("DELIVERED");
    expect(output.decision.delivery?.evidence.length).toBeGreaterThanOrEqual(2);
    expect(output.decision.toolExecutions?.every((t) => t.success)).toBe(true);
    expect(
      output.decision.toolExecutions?.every((t) =>
        ["listDirectory", "readFile", "searchFiles"].includes(t.toolId),
      ),
    ).toBe(true);
    expect(
      output.decision.delivery?.evidence.every(
        (item) =>
          !("error" in item.data) &&
          (item.data.domain === "finance_artifacts" ||
            String(item.data.artifactPath ?? "").startsWith("finance") ||
            String(item.data.artifactPath ?? "").startsWith("billing")),
      ),
    ).toBe(true);

    expect(
      isValidFinancialAnalysisDelivery(
        output.decision.delivery,
        output.decision.toolExecutions,
      ),
    ).toBe(true);
  });

  it("FAILED com evidence quando ToolContext ausente", async () => {
    const aurora = createAurora(new StubLLM());
    const output = await aurora.work({
      briefing: briefingWithTools(null),
    });
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(output.decision.delivery?.type).toBe("financial_analysis");
    expect(output.decision.delivery?.employeeId).toBe("aurora");
    expect(
      isValidFinancialAnalysisDelivery(
        output.decision.delivery,
        output.decision.toolExecutions,
      ),
    ).toBe(false);
  });

  it("overview ausente produz FAILED e delivery invalida", async () => {
    const stub = okFinanceToolContext();
    stub.toolContext.readFile = async () => ({
      ok: false as const,
      error: { code: "NOT_FOUND", message: "missing overview" },
    });
    const aurora = createAurora(new StubLLM());
    const output = await aurora.work({
      briefing: briefingWithTools(stub.toolContext),
    });
    expect(output.decision.delivery?.status).toBe("FAILED");
    expect(
      isValidFinancialAnalysisDelivery(
        output.decision.delivery,
        output.decision.toolExecutions,
      ),
    ).toBe(false);
  });

  it("artefatos opcionais ausentes nao bloqueiam DELIVERED", async () => {
    const stub = okFinanceToolContext();
    const aurora = createAurora(new StubLLM());
    const output = await aurora.work({
      briefing: briefingWithTools(stub.toolContext),
    });
    expect(output.decision.delivery?.status).toBe("DELIVERED");
    expect(
      isValidFinancialAnalysisDelivery(
        output.decision.delivery,
        output.decision.toolExecutions,
      ),
    ).toBe(true);
  });
});
