import { DeterministicLLMProvider } from "@operaia/ai-core";
import {
  EmployeeAlreadyRegisteredError,
  EmployeeRegistry,
  Specialization,
} from "@operaia/employee-framework";
import {
  DelegationService,
  EmployeeMatcher,
  EmployeeRunner,
} from "@operaia/employee-runtime";
import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import {
  DIGITAL_TEAM_EMPLOYEES,
  registerDigitalTeam,
} from "./roster.js";

describe("@operaia/digital-team", () => {
  it("roster contem exatamente os Employees ativos", () => {
    expect(DIGITAL_TEAM_EMPLOYEES).toHaveLength(9);
    const specs = DIGITAL_TEAM_EMPLOYEES.map((e) => e.profile.specialization);
    expect(specs).toContain(Specialization.PRODUCT_DESIGN);
    expect(specs).toContain(Specialization.LEGAL);
    expect(specs).toContain(Specialization.OPERATIONS);
  });

  it("registerDigitalTeam preenche o Registry sem duplicatas", () => {
    const registry = registerDigitalTeam();
    expect(registry.all()).toHaveLength(9);
    expect(() =>
      registry.register(DIGITAL_TEAM_EMPLOYEES[1]!),
    ).toThrow(EmployeeAlreadyRegisteredError);
  });

  it("Matcher localiza apenas por Specialization", () => {
    const registry = registerDigitalTeam();
    const matcher = new EmployeeMatcher(registry);
    expect(matcher.match(Specialization.PRODUCT_DESIGN)?.profile.name).toBe(
      "Luna",
    );
    expect(matcher.match(Specialization.FINANCE)?.profile.name).toBe("Aurora");
    expect(matcher.match(Specialization.LEGAL)?.profile.name).toBe("Themis");
  });

  it("Runtime executa Employee registrado via DelegationService", async () => {
    const llm = new DeterministicLLMProvider();
    const registry = registerDigitalTeam();
    const runner = new EmployeeRunner();
    const matcher = new EmployeeMatcher(registry);
    const delegation = new DelegationService(matcher, runner, { llm });

    const outcomes = await delegation.run(
      [
        {
          specialization: Specialization.AUTOMATION,
          reason: "Automatizar hand-off.",
        },
      ],
      {
        workspace: {
          workspaceId: "nexo",
          name: "NEXO",
          tasks: [
            {
              id: "t1",
              title: "Automatizar sync",
              status: TaskStatus.TODO,
              impact: 4,
              urgency: 4,
            },
          ],
        },
        objective: "Automatizar fluxo operacional",
      },
    );

    expect(outcomes[0]?.matched).toBe(true);
    expect(outcomes[0]?.employeeId).toBe("atlas");
    expect(outcomes[0]?.result?.employeeId).toBe("atlas");
  });

  it("novo Registry vazio nao herda Employees", () => {
    expect(new EmployeeRegistry().all()).toHaveLength(0);
  });
});
