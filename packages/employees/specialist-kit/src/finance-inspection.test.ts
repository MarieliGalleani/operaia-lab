import { describe, expect, it } from "vitest";
import {
  EmployeeDeliveryType,
  type EmployeeBriefing,
  type EmployeeTask,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import {
  isBlockedFinancePathInput,
  validateFinanceListDirectoryPath,
  validateFinanceReadFilePath,
  validateFinanceSearchPrefix,
} from "./finance-artifact-path.js";
import { SpecialistBrain } from "./specialist-brain.js";

class StubLLM {
  async complete() {
    return {
      content: "Conclusao financeira baseada na evidence READ-ONLY.",
      model: "stub",
    };
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

function auroraFinanceConfig() {
  return {
    domainLabel: "financas e planejamento",
    employeeId: "aurora",
    deliveryType: EmployeeDeliveryType.financial_analysis,
    financeArtifactInspection: true,
    readOnlyInspectionTools: [
      "listDirectory",
      "readFile",
      "searchFiles",
    ] as const,
    proposedActions: ["Levantar custos"],
    systemPrompt: "Aurora finance",
  };
}

function createFinanceToolStub(options?: {
  readonly overviewOk?: boolean;
  readonly budgetExists?: boolean;
  readonly costsExists?: boolean;
  readonly billingSummaryExists?: boolean;
  readonly canUseAll?: boolean;
}) {
  const calls: { tool: string; input: Record<string, unknown> }[] = [];
  const overviewOk = options?.overviewOk ?? true;
  const canUseAll = options?.canUseAll ?? true;

  const toolContext = {
    workspaceId: "operaia-lab",
    canUse(toolId: string) {
      if (!canUseAll) {
        return false;
      }
      return (
        toolId === "listDirectory" ||
        toolId === "readFile" ||
        toolId === "searchFiles"
      );
    },
    async listDirectory(input: Record<string, unknown>) {
      calls.push({ tool: "listDirectory", input });
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
      calls.push({ tool: "readFile", input });
      const path = String(input.path ?? "");
      if (path === "finance/overview.md") {
        if (!overviewOk) {
          return {
            ok: false as const,
            error: { code: "NOT_FOUND", message: "missing overview" },
          };
        }
        return {
          ok: true as const,
          data: {
            repository: "marieligalleani/operaia-lab",
            path,
            content: `---
schemaVersion: 1
period: 2026-Q1
currency: BRL
runwayMonths: 12
monthlyBurn: 85000
monthlyRevenue: 120000
riskLevel: medium
notes: agregado sem PII
---
# Overview
runway 12m`,
          },
        };
      }
      if (path === "finance/budget.md") {
        if (options?.budgetExists) {
          return { ok: true as const, data: { repository: "marieligalleani/operaia-lab", path, content: "budget" } };
        }
        return {
          ok: false as const,
          error: { code: "NOT_FOUND", message: "missing budget" },
        };
      }
      if (path === "finance/costs.md") {
        if (options?.costsExists) {
          return { ok: true as const, data: { repository: "marieligalleani/operaia-lab", path, content: "costs" } };
        }
        return {
          ok: false as const,
          error: { code: "NOT_FOUND", message: "missing costs" },
        };
      }
      if (path === "billing/summary.md") {
        if (options?.billingSummaryExists) {
          return { ok: true as const, data: { repository: "marieligalleani/operaia-lab", path, content: "billing" } };
        }
        return {
          ok: false as const,
          error: { code: "NOT_FOUND", message: "missing billing summary" },
        };
      }
      return {
        ok: false as const,
        error: { code: "NOT_FOUND", message: "missing" },
      };
    },
    async searchFiles(input: Record<string, unknown>) {
      calls.push({ tool: "searchFiles", input });
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
      calls.push({ tool: "readRepository", input: {} });
      return { ok: true as const, data: { repository: "should-not-run" } };
    },
  };

  return { calls, toolContext };
}

describe("Finance artifact path boundary P0.2H-5J", () => {
  it("aceita paths financeiros validos", () => {
    expect(validateFinanceReadFilePath("finance/overview.md").ok).toBe(true);
    expect(validateFinanceReadFilePath("finance/budget.md").ok).toBe(true);
    expect(validateFinanceReadFilePath("finance/costs.md").ok).toBe(true);
    expect(validateFinanceReadFilePath("finance/reports/2026/01/summary.md").ok).toBe(
      true,
    );
    expect(validateFinanceReadFilePath("billing/summary.md").ok).toBe(true);
    expect(validateFinanceListDirectoryPath("finance").ok).toBe(true);
    expect(validateFinanceSearchPrefix("finance/").ok).toBe(true);
  });

  it("bloqueia paths invalidos", () => {
    const blocked = [
      "README.md",
      "docs/finance.md",
      "packages/foo.ts",
      "apps/web/src/foo.ts",
      ".env",
      "../finance/overview.md",
      "finance/../README.md",
      "/finance/overview.md",
    ];
    for (const path of blocked) {
      expect(isBlockedFinancePathInput(path)).toBe(true);
      expect(validateFinanceReadFilePath(path).ok).toBe(false);
    }
  });

  it("bloqueia searchFiles sem prefixo ou prefixo invalido", () => {
    expect(validateFinanceSearchPrefix(undefined).ok).toBe(false);
    expect(validateFinanceSearchPrefix("").ok).toBe(false);
    expect(validateFinanceSearchPrefix("packages/").ok).toBe(false);
    expect(validateFinanceSearchPrefix("apps/").ok).toBe(false);
    expect(validateFinanceSearchPrefix("../").ok).toBe(false);
  });

  it("bloqueia profundidade acima de 4 segmentos abaixo da raiz", () => {
    expect(
      validateFinanceReadFilePath("finance/a/b/c/d/e.md").ok,
    ).toBe(false);
  });
});

describe("SpecialistBrain Aurora Finance P0.2H-5J", () => {
  it("executa sequencia financeira READ-ONLY", async () => {
    const stub = createFinanceToolStub({
      budgetExists: true,
      costsExists: true,
    });
    const brain = new SpecialistBrain(new StubLLM() as never, auroraFinanceConfig());
    const decision = await brain.decide(briefingWithTools(stub.toolContext));

    expect(
      stub.calls.filter((c) => c.tool === "listDirectory").map((c) => c.input.path),
    ).toEqual(["finance", "billing"]);
    expect(
      stub.calls.filter((c) => c.tool === "readFile").map((c) => c.input.path),
    ).toEqual([
      "finance/overview.md",
      "finance/budget.md",
      "finance/costs.md",
      "billing/summary.md",
    ]);
    expect(stub.calls.find((c) => c.tool === "searchFiles")?.input).toEqual({
      query: "overview",
      pathPrefix: "finance/",
      limit: 10,
    });
    expect(decision.delivery?.status).toBe("DELIVERED");
    expect(decision.toolExecutions?.every((t) => t.success)).toBe(true);
    expect(decision.toolExecutions?.some((t) => t.toolId === "readRepository")).toBe(
      false,
    );
  });

  it("overview ausente produz FAILED", async () => {
    const stub = createFinanceToolStub({ overviewOk: false });
    const brain = new SpecialistBrain(new StubLLM() as never, auroraFinanceConfig());
    const decision = await brain.decide(briefingWithTools(stub.toolContext));
    expect(decision.delivery?.status).toBe("FAILED");
    expect(
      decision.toolExecutions?.find((t) => t.toolId === "readFile")?.success,
    ).toBe(false);
  });

  it("budget e costs ausentes nao bloqueiam delivery", async () => {
    const stub = createFinanceToolStub();
    const brain = new SpecialistBrain(new StubLLM() as never, auroraFinanceConfig());
    const decision = await brain.decide(briefingWithTools(stub.toolContext));
    expect(decision.delivery?.status).toBe("DELIVERED");
    const readPaths = stub.calls
      .filter((c) => c.tool === "readFile")
      .map((c) => c.input.path);
    expect(readPaths).toContain("finance/budget.md");
    expect(readPaths).toContain("finance/costs.md");
  });

  it("nao invoca readRepository no fluxo financeiro", async () => {
    const stub = createFinanceToolStub();
    const brain = new SpecialistBrain(new StubLLM() as never, auroraFinanceConfig());
    await brain.decide(briefingWithTools(stub.toolContext));
    expect(stub.calls.some((c) => c.tool === "readRepository")).toBe(false);
  });

  it("nao altera fluxo generico de outros employees", async () => {
    let seenPath: unknown;
    const tools = {
      canUse: () => true,
      readFile: async (input: Record<string, unknown>) => {
        seenPath = input.path;
        return { ok: true as const, data: { path: input.path, content: "x" } };
      },
    };
    const brain = new SpecialistBrain(new StubLLM() as never, {
      domainLabel: "juridico",
      employeeId: "themis",
      deliveryType: EmployeeDeliveryType.legal_analysis,
      readOnlyInspectionTools: ["readFile"],
      proposedActions: ["x"],
      systemPrompt: "Themis",
    });
    await brain.decide(briefingWithTools(tools));
    expect(seenPath).toBe("README.md");
  });
});

describe("SpecialistBrain Aurora Finance P0.2H-5K — evidence", () => {
  it("evidence financeira com proveniencia minima e structured", async () => {
    const stub = createFinanceToolStub();
    const brain = new SpecialistBrain(new StubLLM() as never, auroraFinanceConfig());
    const decision = await brain.decide(briefingWithTools(stub.toolContext));

    const overviewEvidence = decision.delivery?.evidence.find(
      (item) =>
        item.source === "readFile" &&
        item.data.artifactPath === "finance/overview.md",
    );
    expect(overviewEvidence).toBeDefined();
    expect(overviewEvidence?.data.domain).toBe("finance_artifacts");
    expect(overviewEvidence?.data.workspaceId).toBe("operaia-lab");
    expect(overviewEvidence?.data.repository).toBe("marieligalleani/operaia-lab");
    expect(overviewEvidence?.data.summary).toBe("overview 12m runway");
    expect(overviewEvidence?.data.structured).toMatchObject({
      runwayMonths: 12,
      monthlyBurn: 85000,
      monthlyRevenue: 120000,
      riskLevel: "medium",
    });
    expect(overviewEvidence?.data.content).toBeUndefined();
    expect(overviewEvidence?.data.contentExcerpt).toBeUndefined();
  });

  it("evidence de listDirectory e searchFiles com source real", async () => {
    const stub = createFinanceToolStub();
    const brain = new SpecialistBrain(new StubLLM() as never, auroraFinanceConfig());
    const decision = await brain.decide(briefingWithTools(stub.toolContext));

    const listEvidence = decision.delivery?.evidence.find(
      (item) => item.source === "listDirectory" && item.data.artifactPath === "finance",
    );
    expect(listEvidence?.data.domain).toBe("finance_artifacts");

    const searchEvidence = decision.delivery?.evidence.find(
      (item) => item.source === "searchFiles",
    );
    expect(searchEvidence?.data.domain).toBe("finance_artifacts");
    expect(searchEvidence?.data.artifactPath).toBe("finance/");
  });

  it("toolExecutions preservam toolId, success e at", async () => {
    const stub = createFinanceToolStub();
    const brain = new SpecialistBrain(new StubLLM() as never, auroraFinanceConfig());
    const decision = await brain.decide(briefingWithTools(stub.toolContext));

    for (const exec of decision.toolExecutions ?? []) {
      expect(exec.toolId).toBeTruthy();
      expect(typeof exec.success).toBe("boolean");
      expect(exec.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("resultJson-like delivery nao contem content integral nem secrets", async () => {
    const stub = createFinanceToolStub();
    const brain = new SpecialistBrain(new StubLLM() as never, auroraFinanceConfig());
    const decision = await brain.decide(briefingWithTools(stub.toolContext));
    const serialized = JSON.stringify(decision.delivery ?? {});

    expect(serialized).not.toContain("sk-live");
    expect(serialized).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
    expect(serialized).not.toContain("# Overview");
  });
});
