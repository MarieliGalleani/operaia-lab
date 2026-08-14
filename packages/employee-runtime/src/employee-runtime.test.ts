import {
  EmployeeNotFoundError,
  EmployeeRegistry,
  Specialization,
  type Employee,
  type EmployeeInput,
  type EmployeeOutput,
  type EmployeeProfile,
  type RegisteredEmployee,
} from "@operaia/employee-framework";
import { ActionType } from "@operaia/execution-engine";
import { Priority, TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import {
  DelegationService,
  EmployeeActionMapper,
  EmployeeMatcher,
  EmployeeRunner,
  WorkspaceBriefingAdapter,
} from "./index.js";

function makeProfile(
  id: string,
  specialization: Specialization,
): EmployeeProfile {
  return {
    id,
    name: id,
    role: id,
    mission: "m",
    specialization,
    capabilities: [],
    permissions: [],
    limits: [],
    qualityRules: [],
  };
}

function fakeOutput(objective: string): EmployeeOutput {
  return {
    decision: {
      analyzed: "",
      decision: `feito: ${objective}`,
      reasoning: "r",
      recommendations: ["plano"],
      delegations: [],
      risks: [],
      nextActions: ["acao"],
    },
    report: {
      summary: `feito: ${objective}`,
      analysis: "a",
      plan: ["plano"],
      recommendations: ["-"],
      risks: ["-"],
      nextActions: ["acao"],
    },
    quality: { passed: true, issues: [] },
  };
}

function fakeEmployee(profile: EmployeeProfile): Employee {
  return {
    profile,
    async work(input: EmployeeInput): Promise<EmployeeOutput> {
      return fakeOutput(input.briefing.objective);
    },
  };
}

function fakeRegistered(profile: EmployeeProfile): RegisteredEmployee {
  return { profile, create: () => fakeEmployee(profile) };
}

const workspace = {
  workspaceId: "nexo",
  name: "NEXO",
  tasks: [
    { id: "t1", title: "Login", status: TaskStatus.TODO },
    { id: "t2", title: "Docs", status: TaskStatus.DONE },
  ],
};

describe("WorkspaceBriefingAdapter", () => {
  it("adapta o snapshot do Workspace em um EmployeeBriefing", () => {
    const briefing = new WorkspaceBriefingAdapter().toBriefing(
      workspace,
      "Finalizar a NEXO",
    );
    expect(briefing.project).toBe("NEXO");
    expect(briefing.objective).toBe("Finalizar a NEXO");
    expect(briefing.pending).toEqual(["Login"]);
  });
});

describe("EmployeeRunner", () => {
  it("coloca o funcionario para trabalhar dentro do Workspace", async () => {
    const runner = new EmployeeRunner();
    const employee = fakeEmployee(
      makeProfile("dev", Specialization.SOFTWARE_ENGINEERING),
    );
    const result = await runner.run(employee, {
      workspace,
      objective: "Finalizar a NEXO",
    });
    expect(result.employeeId).toBe("dev");
    expect(result.briefing.project).toBe("NEXO");
    expect(result.output.report.summary).toContain("Finalizar a NEXO");
  });

  it("F5: injeta previousDelivery em briefing.additional", async () => {
    const runner = new EmployeeRunner();
    const employee = fakeEmployee(
      makeProfile("ceo", Specialization.MANAGEMENT),
    );
    const sourceMissionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const result = await runner.run(employee, {
      workspace,
      objective: `[SOURCE_EXECUTE:${sourceMissionId}] Priorize`,
      previousDelivery: {
        sourceMissionId,
        delivery: {
          type: "technical_analysis",
          status: "DELIVERED",
          missionId: sourceMissionId,
          employeeId: "cto-mag",
          objective: "Analise",
          summary: "ok",
          findings: ["finding-a"],
          evidence: [{ source: "readRepository", data: { repository: "x/y" } }],
          recommendations: ["rec-a"],
          deliveredAt: "2026-08-12T00:00:00.000Z",
        },
      },
    });

    const previous = result.briefing.additional.previousDelivery as {
      sourceMissionId: string;
      delivery: { findings: string[] };
    };
    expect(previous.sourceMissionId).toBe(sourceMissionId);
    expect(previous.delivery.findings).toEqual(["finding-a"]);
  });
});

describe("EmployeeMatcher", () => {
  const registry = new EmployeeRegistry()
    .register(fakeRegistered(makeProfile("ceo", Specialization.MANAGEMENT)))
    .register(
      fakeRegistered(makeProfile("dev", Specialization.SOFTWARE_ENGINEERING)),
    );
  const matcher = new EmployeeMatcher(registry);

  it("encontra funcionario compativel com a especialidade", () => {
    const match = matcher.match(Specialization.SOFTWARE_ENGINEERING);
    expect(match?.profile.id).toBe("dev");
  });

  it("retorna undefined quando a especialidade nao existe no quadro", () => {
    expect(matcher.match(Specialization.MARKETING)).toBeUndefined();
  });

  it("funcionario inexistente por id lanca EmployeeNotFoundError", () => {
    expect(() => registry.require("fantasma")).toThrow(EmployeeNotFoundError);
  });
});

describe("EmployeeActionMapper", () => {
  it("mapeia EmployeeTask -> Actions ignorando concluidas", () => {
    const actions = new EmployeeActionMapper().toActions([
      { id: "t1", title: "Login", status: TaskStatus.TODO, impact: 5, urgency: 5 },
      { id: "t2", title: "Docs", status: TaskStatus.DONE },
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe(ActionType.CREATE_TASK);
    expect(actions[0]?.priority).toBe(Priority.URGENT);
  });

  it("gera um ExecutionPlan a partir das tarefas", () => {
    const plan = new EmployeeActionMapper().toExecutionPlan([
      { id: "t1", title: "Login", status: TaskStatus.TODO },
    ]);
    expect(plan.actions).toHaveLength(1);
    expect(plan.metadata?.source).toBe("employee-runtime");
  });
});

describe("DelegationService", () => {
  const registry = new EmployeeRegistry().register(
    fakeRegistered(makeProfile("dev", Specialization.SOFTWARE_ENGINEERING)),
  );
  const service = new DelegationService(
    new EmployeeMatcher(registry),
    new EmployeeRunner(),
  );

  it("resolve a especialidade e executa o especialista", async () => {
    const outcomes = await service.run(
      [
        {
          specialization: Specialization.SOFTWARE_ENGINEERING,
          reason: "Necessito de analise tecnica.",
          task: "Analisar arquitetura da NEXO",
        },
      ],
      { workspace, objective: "Finalizar a NEXO" },
    );
    expect(outcomes[0]?.matched).toBe(true);
    expect(outcomes[0]?.employeeId).toBe("dev");
    expect(outcomes[0]?.result?.briefing.objective).toBe(
      "Analisar arquitetura da NEXO",
    );
  });

  it("marca matched=false quando a especialidade nao e encontrada", async () => {
    const outcomes = await service.run(
      [{ specialization: Specialization.LEGAL, reason: "Preciso de juridico." }],
      { workspace, objective: "Finalizar a NEXO" },
    );
    expect(outcomes[0]?.matched).toBe(false);
    expect(outcomes[0]?.result).toBeUndefined();
  });
});
