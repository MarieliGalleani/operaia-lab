import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { BriefingBuilder } from "./briefing/briefing-builder.js";
import { validateBriefing } from "./briefing/briefing-validator.js";
import type { EmployeeBriefing } from "./briefing/employee-briefing.js";
import type { EmployeeDecision } from "./decision/decision-model.js";
import { DefaultDelegationPolicy } from "./defaults/default-delegation-policy.js";
import { DefaultQualityPolicy } from "./defaults/default-quality-policy.js";
import { DefaultResponsePolicy } from "./defaults/default-response-policy.js";
import type { EmployeeBrain } from "./employee/employee-contract.js";
import type { EmployeeProfile } from "./employee/employee-profile.js";
import { Specialization } from "./employee/employee-specialization.js";
import {
  EmployeeFactory,
  type EmployeeBlueprint,
} from "./factory/employee-factory.js";
import {
  EmployeeRegistry,
  defineEmployee,
} from "./factory/employee-registry.js";
import { BriefingValidationError, EmployeeNotFoundError } from "./errors/index.js";

// --- fixtures --------------------------------------------------------------

const profile: EmployeeProfile = {
  id: "tester",
  name: "Tester",
  role: "QA",
  mission: "Testar",
  specialization: Specialization.SOFTWARE_ENGINEERING,
  capabilities: ["testar"],
  permissions: ["rodar testes"],
  limits: ["nao faz deploy"],
  qualityRules: ["cobertura"],
};

function decision(overrides: Partial<EmployeeDecision> = {}): EmployeeDecision {
  return {
    analyzed: "Analisei o estado.",
    decision: "Decidi priorizar X.",
    reasoning: "Porque X tem maior impacto.",
    recommendations: ["Fazer X"],
    delegations: [],
    risks: [],
    nextActions: ["Executar X"],
    ...overrides,
  };
}

class FixedBrain implements EmployeeBrain {
  constructor(private readonly value: EmployeeDecision) {}
  async decide(): Promise<EmployeeDecision> {
    return this.value;
  }
}

function briefing(overrides: Partial<EmployeeBriefing> = {}): EmployeeBriefing {
  return {
    project: "NEXO",
    objective: "Finalizar",
    executiveSummary: "",
    currentState: "",
    pending: [],
    tasks: [],
    documentation: [],
    history: [],
    constraints: [],
    successCriteria: [],
    additional: {},
    ...overrides,
  };
}

// --- BriefingBuilder -------------------------------------------------------

describe("BriefingBuilder", () => {
  it("transforma um WorkspaceSnapshot em EmployeeBriefing", () => {
    const result = new BriefingBuilder().build(
      {
        workspaceId: "nexo",
        name: "NEXO",
        tasks: [
          { id: "t1", title: "Login", status: TaskStatus.TODO },
          { id: "t2", title: "Docs", status: TaskStatus.DONE },
        ],
        documents: ["prd.md"],
      },
      "Finalizar a NEXO",
    );

    expect(result.project).toBe("NEXO");
    expect(result.objective).toBe("Finalizar a NEXO");
    expect(result.pending).toEqual(["Login"]);
    expect(result.currentState).toContain("1/2");
    expect(result.documentation).toEqual(["prd.md"]);
  });
});

describe("validateBriefing", () => {
  it("aceita um briefing valido", () => {
    expect(() => validateBriefing(briefing())).not.toThrow();
  });

  it("rejeita um briefing sem objetivo", () => {
    expect(() => validateBriefing(briefing({ objective: "" }))).toThrow(
      BriefingValidationError,
    );
  });
});

// --- Policies --------------------------------------------------------------

describe("DefaultResponsePolicy", () => {
  it("monta as 6 secoes padrao", () => {
    const report = new DefaultResponsePolicy().build(
      decision({
        delegations: [
          { specialization: Specialization.UX_DESIGN, reason: "telas" },
        ],
      }),
      briefing(),
    );

    expect(report.summary).toBe("Decidi priorizar X.");
    expect(report.plan).toEqual(["Fazer X"]);
    expect(report.recommendations[0]).toContain("UX_DESIGN");
    expect(report.nextActions).toEqual(["Executar X"]);
  });
});

describe("DefaultQualityPolicy", () => {
  it("aprova uma decisao completa", () => {
    const response = new DefaultResponsePolicy();
    const result = new DefaultQualityPolicy().validate(
      decision(),
      response.build(decision(), briefing()),
      profile,
    );
    expect(result.passed).toBe(true);
  });

  it("reprova quando falta justificativa", () => {
    const bad = decision({ reasoning: "" });
    const response = new DefaultResponsePolicy();
    const result = new DefaultQualityPolicy().validate(
      bad,
      response.build(bad, briefing()),
      profile,
    );
    expect(result.passed).toBe(false);
    expect(result.issues.map((issue) => issue.rule)).toContain("reasoning");
  });
});

describe("DefaultDelegationPolicy", () => {
  it("remove delegacoes para a propria especialidade e deduplica", () => {
    const result = new DefaultDelegationPolicy().resolve(
      [
        { specialization: Specialization.SOFTWARE_ENGINEERING, reason: "codar" },
        { specialization: Specialization.UX_DESIGN, reason: "telas" },
        { specialization: Specialization.UX_DESIGN, reason: "telas" },
      ],
      profile,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.specialization).toBe(Specialization.UX_DESIGN);
  });
});

// --- Factory + Registry ----------------------------------------------------

describe("EmployeeFactory + Registry", () => {
  const blueprint: EmployeeBlueprint = {
    profile,
    build: () => new FixedBrain(decision()),
  };

  it("cria um funcionario configurado e executa o pipeline completo", async () => {
    const employee = new EmployeeFactory().create(blueprint, undefined);
    const output = await employee.work({ briefing: briefing() });

    expect(employee.profile.id).toBe("tester");
    expect(output.report.summary).toBe("Decidi priorizar X.");
    expect(output.quality.passed).toBe(true);
  });

  it("registra e recupera funcionarios; falha em id desconhecido", () => {
    const registry = new EmployeeRegistry();
    registry.register(defineEmployee(blueprint));

    expect(registry.profiles().map((profileItem) => profileItem.id)).toEqual([
      "tester",
    ]);
    expect(registry.require("tester").profile.name).toBe("Tester");
    expect(() => registry.require("ghost")).toThrow(EmployeeNotFoundError);
  });

  it("cria via registry aplicando as politicas padrao", async () => {
    const registry = new EmployeeRegistry().register(defineEmployee(blueprint));
    const employee = registry.require("tester").create();
    const output = await employee.work({ briefing: briefing() });
    expect(output.report.risks[0]).toContain("Nenhum risco");
  });
});
