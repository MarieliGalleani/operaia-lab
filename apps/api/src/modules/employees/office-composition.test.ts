/**
 * Composition Root da Equipe Digital — registro, matcher, delegação e execução.
 */
import type { LLMCompletion, LLMMessage, LLMProvider } from "@operaia/ai-core";
import {
  DIGITAL_TEAM_EMPLOYEES,
  registerDigitalTeam,
} from "@operaia/digital-team";
import {
  EmployeeAlreadyRegisteredError,
  EmployeeRegistry,
  Specialization,
  defineEmployee,
  type EmployeeBlueprint,
  type EmployeeProfile,
} from "@operaia/employee-framework";
import {
  EmployeeMatcher,
  type EmployeeContext,
} from "@operaia/employee-runtime";
import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { createDigitalOffice } from "./office-composition.js";

class StubLLM implements LLMProvider {
  readonly name = "stub";
  async complete(_messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    return { content: "Resumo do funcionario.", model: "stub" };
  }
}

const EXPECTED_IDS = [
  "operaia-ceo",
  "cto-mag",
  "luna",
  "nexus",
  "atlas",
  "aurora",
  "themis",
  "mercurio",
  "orion",
] as const;

const SPECIALIZATION_TO_ID: ReadonlyArray<{
  readonly specialization: Specialization;
  readonly id: string;
}> = [
  { specialization: Specialization.MANAGEMENT, id: "operaia-ceo" },
  { specialization: Specialization.SOFTWARE_ENGINEERING, id: "cto-mag" },
  { specialization: Specialization.PRODUCT_DESIGN, id: "luna" },
  { specialization: Specialization.PRODUCT_MANAGEMENT, id: "nexus" },
  { specialization: Specialization.AUTOMATION, id: "atlas" },
  { specialization: Specialization.FINANCE, id: "aurora" },
  { specialization: Specialization.LEGAL, id: "themis" },
  { specialization: Specialization.MARKETING, id: "mercurio" },
  { specialization: Specialization.OPERATIONS, id: "orion" },
];

const nexoContext: EmployeeContext = {
  workspace: {
    workspaceId: "nexo",
    name: "NEXO",
    tasks: [
      {
        id: "t1",
        title: "Implementar autenticacao",
        status: TaskStatus.TODO,
        impact: 5,
        urgency: 5,
      },
      {
        id: "t2",
        title: "Sincronizar dados offline",
        status: TaskStatus.TODO,
        impact: 4,
        urgency: 3,
        dependsOn: ["t1"],
      },
      { id: "t3", title: "Escrever documentacao", status: TaskStatus.DONE },
    ],
  },
  objective: "Finalizar desenvolvimento da NEXO",
};

describe("Contratação — Equipe Digital executável", () => {
  it("registra automaticamente todos os Employees do roster", () => {
    const registry = registerDigitalTeam();
    expect(registry.all()).toHaveLength(EXPECTED_IDS.length);
    expect(DIGITAL_TEAM_EMPLOYEES.map((e) => e.profile.id)).toEqual([
      ...EXPECTED_IDS,
    ]);
    for (const id of EXPECTED_IDS) {
      expect(registry.require(id).profile.version).toBeTruthy();
    }
  });

  it("createDigitalOffice usa exclusivamente o roster registrado", () => {
    const office = createDigitalOffice({ llm: new StubLLM() });
    expect(office.registry.all().map((e) => e.profile.id)).toEqual([
      ...EXPECTED_IDS,
    ]);
    expect(office.registry.require("operaia-ceo").profile.name).toBe("Opera");
    expect(office.registry.require("operaia-ceo").profile.role).toBe("CEO");
  });

  it("Matcher resolve cada especialização sem lógica por nome", () => {
    const { matcher } = createDigitalOffice({ llm: new StubLLM() });
    for (const { specialization, id } of SPECIALIZATION_TO_ID) {
      expect(matcher.match(specialization)?.profile.id).toBe(id);
    }
  });

  it("matchAll retorna múltiplos Employees da mesma especialização", () => {
    const registry = new EmployeeRegistry();
    const profileA = stubProfile("eng-a", Specialization.SOFTWARE_ENGINEERING);
    const profileB = stubProfile("eng-b", Specialization.SOFTWARE_ENGINEERING);
    registry.register(defineEmployee(stubBlueprint(profileA)));
    registry.register(defineEmployee(stubBlueprint(profileB)));
    const matcher = new EmployeeMatcher(registry);

    const matches = matcher.matchAll(Specialization.SOFTWARE_ENGINEERING);
    expect(matches.map((m) => m.profile.id).sort()).toEqual(["eng-a", "eng-b"]);
    expect(matcher.match(Specialization.SOFTWARE_ENGINEERING)?.profile.id).toBe(
      "eng-a",
    );
  });

  it("especialização inexistente no quadro retorna matched=false", async () => {
    const { delegation } = createDigitalOffice({ llm: new StubLLM() });
    const unknown = "UNKNOWN_SPECIALIZATION" as Specialization;

    const outcomes = await delegation.run(
      [{ specialization: unknown, reason: "Dominio sem especialista." }],
      nexoContext,
    );

    expect(outcomes[0]?.matched).toBe(false);
    expect(outcomes[0]?.employeeId).toBeUndefined();
  });

  it("registro duplicado e rejeitado", () => {
    const registry = registerDigitalTeam();
    expect(() => registry.register(DIGITAL_TEAM_EMPLOYEES[0]!)).toThrow(
      EmployeeAlreadyRegisteredError,
    );
  });

  it("CEO delega por Specialization; Runtime executa Mag e retorna ao CEO", async () => {
    const { registry, runner, delegation, llm } = createDigitalOffice({
      llm: new StubLLM(),
    });

    const ceo = registry.require("operaia-ceo").create({ llm });
    const ceoResult = await runner.run(ceo, nexoContext);
    const delegations = ceoResult.output.decision.delegations;

    expect(delegations).toHaveLength(1);
    expect(delegations[0]?.specialization).toBe(
      Specialization.SOFTWARE_ENGINEERING,
    );

    const outcomes = await delegation.run(delegations, nexoContext);
    expect(outcomes[0]?.matched).toBe(true);
    expect(outcomes[0]?.employeeId).toBe("cto-mag");
    expect(outcomes[0]?.result?.output.report.plan.length).toBeGreaterThan(0);
    expect(outcomes[0]?.result?.output.quality.passed).toBe(true);
  });

  it("Opera pode delegar para qualquer especialização registrada", async () => {
    const { delegation } = createDigitalOffice({ llm: new StubLLM() });

    for (const { specialization, id } of SPECIALIZATION_TO_ID.filter(
      (entry) => entry.specialization !== Specialization.MANAGEMENT,
    )) {
      const outcomes = await delegation.run(
        [{ specialization, reason: `Missao de ${specialization}.` }],
        nexoContext,
      );
      expect(outcomes[0]?.matched).toBe(true);
      expect(outcomes[0]?.employeeId).toBe(id);
      expect(outcomes[0]?.result?.output.quality.passed).toBe(true);
    }
  });
});

function stubProfile(
  id: string,
  specialization: Specialization,
): EmployeeProfile {
  return {
    id,
    name: id,
    role: "Engineer",
    mission: "test",
    specialization,
    version: "1.0.0",
    capabilities: [],
    permissions: [],
    limits: [],
    qualityRules: [],
  };
}

function stubBlueprint(
  profile: EmployeeProfile,
): EmployeeBlueprint<{ llm: LLMProvider }> {
  return {
    profile,
    build: () => ({
      decide: async () => ({
        analyzed: "ok",
        decision: "ok",
        reasoning: "ok",
        recommendations: ["acao"],
        delegations: [],
        risks: [],
        nextActions: ["proximo"],
      }),
    }),
  };
}
