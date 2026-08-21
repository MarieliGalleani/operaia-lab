import { describe, expect, it } from "vitest";
import {
  EmployeeDeliveryType,
  type EmployeeBriefing,
  type EmployeeTask,
} from "@operaia/employee-framework";
import { TaskStatus } from "@operaia/shared";
import {
  SPECIALIST_READ_ONLY_TOOL_IDS,
  SpecialistBrain,
  buildSpecialistSystemPrompt,
} from "./specialist-brain.js";

class StubLLM {
  async complete() {
    return {
      content:
        "Conclusao baseada na evidence READ-ONLY disponivel no briefing.",
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
      title: "Inspecionar infra",
      status: TaskStatus.TODO,
    },
  ];
  return {
    objective: "Auditar automacao do lab",
    project: "operaia-lab",
    executiveSummary: "Resumo",
    currentState: "Estado atual",
    pending: ["Inspecionar infra"],
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

describe("SpecialistBrain P0.2B contract", () => {
  it("exporta lista READ-ONLY sem tools destrutivas", () => {
    expect(SPECIALIST_READ_ONLY_TOOL_IDS).toContain("listInfrastructure");
    expect(SPECIALIST_READ_ONLY_TOOL_IDS).toContain("readLogs");
    expect(SPECIALIST_READ_ONLY_TOOL_IDS as readonly string[]).not.toContain(
      "docker.restart",
    );
  });

  it("sem deliveryType permanece legado (sem delivery)", async () => {
    const brain = new SpecialistBrain(new StubLLM() as never, {
      domainLabel: "design",
      proposedActions: ["Mapear jornada"],
      systemPrompt: buildSpecialistSystemPrompt({
        identity: "Luna",
        mission: "UX",
        thinking: "pensar",
        limits: "limites",
      }),
    });
    const decision = await brain.decide(briefingWithTools(null));
    expect(decision.delivery).toBeUndefined();
    expect(decision.recommendations.length).toBeGreaterThan(0);
  });

  it("FAILED quando ToolContext ausente (evidence do contrato)", async () => {
    const brain = new SpecialistBrain(new StubLLM() as never, {
      domainLabel: "automacao",
      employeeId: "atlas",
      deliveryType: EmployeeDeliveryType.automation_result,
      readOnlyInspectionTools: ["listInfrastructure"],
      proposedActions: ["Mapear"],
      systemPrompt: "Atlas",
    });
    const decision = await brain.decide(briefingWithTools(null));
    expect(decision.delivery?.status).toBe("FAILED");
    expect(decision.delivery?.type).toBe("automation_result");
    expect(decision.delivery?.evidence.length).toBeGreaterThan(0);
    expect(decision.delivery?.evidence[0]?.source).toBe("specialist_contract");
  });

  it("Atlas: DELIVERED com evidence de listInfrastructure", async () => {
    const tools = {
      canUse: (id: string) => id === "listInfrastructure",
      listInfrastructure: async () => ({
        ok: true as const,
        data: {
          artifacts: [{ name: "docker-compose.yml", kind: "compose" }],
          workspaceId: "ws-1",
        },
      }),
    };
    const brain = new SpecialistBrain(new StubLLM() as never, {
      domainLabel: "automacao",
      employeeId: "atlas",
      deliveryType: EmployeeDeliveryType.automation_result,
      readOnlyInspectionTools: ["listInfrastructure", "readCaddy"],
      proposedActions: ["Mapear"],
      systemPrompt: "Atlas",
    });
    const decision = await brain.decide(briefingWithTools(tools));
    expect(decision.toolExecutions?.some((t) => t.toolId === "listInfrastructure")).toBe(
      true,
    );
    expect(decision.delivery?.status).toBe("FAILED");
    // readCaddy sem permissao → FAILED mas com evidence
    expect(decision.delivery?.evidence.some((e) => e.source === "listInfrastructure")).toBe(
      true,
    );
    expect(decision.delivery?.evidence.some((e) => e.source === "readCaddy")).toBe(
      true,
    );
  });

  it("Atlas: DELIVERED quando todas as tools READ-ONLY ok", async () => {
    const tools = {
      canUse: () => true,
      listInfrastructure: async () => ({
        ok: true as const,
        data: { artifacts: [{ name: "Caddyfile" }] },
      }),
      readDockerCompose: async () => ({
        ok: true as const,
        data: { path: "docker-compose.yml", content: "services: {}" },
      }),
      readCaddy: async () => ({
        ok: true as const,
        data: { path: "Caddyfile", content: "lab.operaia.com.br {}" },
      }),
      readLogs: async () => ({
        ok: true as const,
        data: { source: "journal", lines: ["ok"] },
      }),
    };
    const brain = new SpecialistBrain(new StubLLM() as never, {
      domainLabel: "automacao",
      employeeId: "atlas",
      deliveryType: EmployeeDeliveryType.automation_result,
      readOnlyInspectionTools: [
        "listInfrastructure",
        "readDockerCompose",
        "readCaddy",
        "readLogs",
      ],
      proposedActions: ["Mapear"],
      systemPrompt: "Atlas",
    });
    const decision = await brain.decide(briefingWithTools(tools));
    expect(decision.delivery?.status).toBe("DELIVERED");
    expect(decision.delivery?.type).toBe(
      EmployeeDeliveryType.automation_result,
    );
    expect(decision.delivery?.evidence.length).toBe(4);
    expect(decision.delivery?.findings.length).toBeGreaterThan(0);
  });

  it("Orion: DELIVERED com readLogs + readWorkflow", async () => {
    const tools = {
      canUse: () => true,
      readLogs: async () => ({
        ok: true as const,
        data: { source: "journal", lines: ["worker alive"] },
      }),
      readWorkflow: async () => ({
        ok: true as const,
        data: { id: "wf-1", name: "ops-check" },
      }),
    };
    const brain = new SpecialistBrain(new StubLLM() as never, {
      domainLabel: "operacoes",
      employeeId: "orion",
      deliveryType: EmployeeDeliveryType.operations_analysis,
      readOnlyInspectionTools: ["readLogs", "readWorkflow"],
      proposedActions: ["Mapear fluxo"],
      systemPrompt: "Orion",
    });
    const decision = await brain.decide(briefingWithTools(tools));
    expect(decision.delivery?.status).toBe("DELIVERED");
    expect(decision.delivery?.type).toBe(
      EmployeeDeliveryType.operations_analysis,
    );
    expect(decision.delivery?.employeeId).toBe("orion");
    expect(decision.toolExecutions).toHaveLength(2);
  });

  it("bloqueia tool fora do allowlist READ-ONLY", async () => {
    const tools = { canUse: () => true };
    const brain = new SpecialistBrain(new StubLLM() as never, {
      domainLabel: "automacao",
      employeeId: "atlas",
      deliveryType: EmployeeDeliveryType.automation_result,
      readOnlyInspectionTools: ["docker.restart" as never],
      proposedActions: ["x"],
      systemPrompt: "Atlas",
    });
    const decision = await brain.decide(briefingWithTools(tools));
    expect(decision.delivery?.status).toBe("FAILED");
    expect(
      decision.delivery?.evidence.some(
        (e) => e.data.error === "TOOL_NOT_READ_ONLY",
      ),
    ).toBe(true);
  });

  it("Orion: readWorkflow invoca com workflowIdOrPath", async () => {
    let seen: unknown;
    const tools = {
      canUse: () => true,
      readWorkflow: async (input: Record<string, unknown>) => {
        seen = input;
        return {
          ok: true as const,
          data: { path: ".github/workflows/ci.yml" },
        };
      },
    };
    const brain = new SpecialistBrain(new StubLLM() as never, {
      domainLabel: "operacoes",
      employeeId: "orion",
      deliveryType: EmployeeDeliveryType.operations_analysis,
      readOnlyInspectionTools: ["readWorkflow"],
      proposedActions: ["x"],
      systemPrompt: "Orion",
    });
    const decision = await brain.decide(briefingWithTools(tools));
    expect(seen).toEqual({ workflowIdOrPath: "ci.yml" });
    expect(decision.delivery?.status).toBe("DELIVERED");
  });
});
