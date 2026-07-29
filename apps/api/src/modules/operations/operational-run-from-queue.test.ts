import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it } from "vitest";
import { CEO_EMPLOYEE_ID, MissionKind } from "../runtime/mission-states.js";
import type { StoredEmployeeResult } from "../runtime/mission-result-store.js";
import {
  MissionTreeProjectionError,
  projectMissionToOperationalRun,
  projectMissionTreeToOperationalRun,
  QUEUE_EXECUTION_STUB_ID,
  type QueueMissionNode,
  type QueueMissionSnapshot,
} from "./operational-run-from-queue.js";

function storedCeo(
  overrides: {
    decision?: string;
    analyzed?: string;
    summary?: string;
    delegations?: StoredEmployeeResult["output"]["decision"]["delegations"];
  } = {},
): StoredEmployeeResult {
  return {
    employeeId: CEO_EMPLOYEE_ID,
    output: {
      decision: {
        analyzed: overrides.analyzed ?? "analise",
        decision: overrides.decision ?? "responder",
        reasoning: "motivo",
        recommendations: [],
        risks: [],
        nextActions: ["seguir"],
        delegations: overrides.delegations ?? [],
      },
      report: {
        summary: overrides.summary ?? "resumo ceo",
        analysis: "a",
        plan: [],
        recommendations: [],
        risks: [],
        nextActions: ["seguir"],
      },
      quality: { passed: true, issues: [] },
    },
  };
}

function storedSpecialist(employeeId: string): StoredEmployeeResult {
  return {
    employeeId,
    output: {
      decision: {
        analyzed: "auth",
        decision: "implementar",
        reasoning: "ok",
        recommendations: [],
        risks: [],
        nextActions: [],
        delegations: [],
      },
      report: {
        summary: "Auth entregue",
        analysis: "",
        plan: [],
        recommendations: [],
        risks: [],
        nextActions: [],
      },
      quality: { passed: true, issues: [] },
    },
  };
}

function rootNode(
  overrides: Partial<QueueMissionNode> & {
    resultJson: unknown;
  },
): QueueMissionNode {
  return {
    id: "root-1",
    status: "COMPLETED",
    workspaceId: "nexo",
    objective: "Fechar autenticacao",
    missionKind: MissionKind.COORDINATE,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    requiredSpecialization: null,
    parentMissionId: null,
    startedAt: "2026-07-28T12:00:00.000Z",
    finishedAt: "2026-07-28T12:05:00.000Z",
    ...overrides,
  };
}

describe("projectMissionToOperationalRun (Fase 2.0 parcial)", () => {
  function baseMission(
    overrides: Partial<QueueMissionSnapshot> = {},
  ): QueueMissionSnapshot {
    return {
      id: "mission-1",
      status: "COMPLETED",
      workspaceId: "nexo",
      objective: "Fechar autenticacao",
      resultJson: null,
      startedAt: "2026-07-28T12:00:00.000Z",
      finishedAt: "2026-07-28T12:01:00.000Z",
      ...overrides,
    };
  }

  it("projeta id, status, objective e resultJson", () => {
    const projection = projectMissionToOperationalRun({
      mission: baseMission({ resultJson: { phase: "coordinated" } }),
      workspaceName: "NEXO",
    });

    expect(projection.id).toBe("mission-1");
    expect(projection.status).toBe("COMPLETED");
    expect(projection.usableResult).toBeNull();
    expect(
      projection.gaps.some((g) => g.code === "assisted-projection-partial"),
    ).toBe(true);
  });

  it("extrai usableResult e reply quando consolidated", () => {
    const final = storedCeo({ summary: "Resumo executivo" });
    const projection = projectMissionToOperationalRun({
      mission: baseMission({
        resultJson: {
          phase: "consolidated",
          usableResult: "Resumo executivo",
          final,
        },
      }),
      workspaceName: "NEXO",
    });

    expect(projection.usableResult).toBe("Resumo executivo");
    expect(projection.reply?.answer.summary).toBe("Resumo executivo");
  });

  it("registra gap de compatibilidade quando employeeId != Opera", () => {
    const projection = projectMissionToOperationalRun({
      mission: baseMission(),
      workspaceName: "NEXO",
      requestedEmployeeId: "mag-cto",
    });
    expect(
      projection.gaps.some((g) => g.code === "assisted-owner-forced-opera"),
    ).toBe(true);
  });
});

describe("projectMissionTreeToOperationalRun (Fase 2.1b)", () => {
  it("Caso 1: COORDINATE sem delegacao — initial, final e reply", () => {
    const ceo = storedCeo({
      decision: "responder",
      summary: "Status do NEXO ok",
    });
    const run = projectMissionTreeToOperationalRun({
      root: rootNode({
        resultJson: {
          phase: "consolidated",
          initial: ceo,
          usableResult: "Status do NEXO ok",
          final: ceo,
          timing: {
            ceoMs: 0,
            specialistMs: 0,
            consolidationMs: 0,
            totalMs: 100,
          },
        },
      }),
      children: [],
      workspaceName: "NEXO",
    });

    expect(run.id).toBe("root-1");
    expect(run.status).toBe("completed");
    expect(run.mission.initial.output.decision.decision).toBe("responder");
    expect(run.mission.final.output.decision.decision).toBe("responder");
    expect(run.mission.outcomes).toHaveLength(0);
    expect(run.reply.answer.summary).toBe("Status do NEXO ok");
    expect(run.usableResult).toBe("Status do NEXO ok");
    expect(run.workflow.steps.length).toBeGreaterThan(0);
    expect(run.llmEvents).toEqual([]);
    expect(run.execution.planId).toBe(QUEUE_EXECUTION_STUB_ID);
    expect(run.execution.status).toBe("untracked");
    expect(
      run.gaps.some((g) => g.code === "assisted-llm-events-unavailable"),
    ).toBe(true);
  });

  it("Caso 2: COORDINATE + EXECUTE — outcomes, specialist e delegacao", () => {
    const initial = storedCeo({
      decision: "delegar",
      analyzed: "precisa auth",
      summary: "delegar",
      delegations: [
        {
          specialization: Specialization.SOFTWARE_ENGINEERING,
          reason: "tecnico",
          task: "implementar auth",
        },
      ],
    });
    const final = storedCeo({
      decision: "seguir",
      analyzed: "consolidado",
      summary: "Auth priorizada",
    });
    const specialist = storedSpecialist("cto-mag");

    const run = projectMissionTreeToOperationalRun({
      root: rootNode({
        resultJson: {
          phase: "consolidated",
          initial,
          usableResult: "Auth priorizada",
          final,
        },
      }),
      children: [
        {
          id: "exec-1",
          status: "COMPLETED",
          workspaceId: "nexo",
          objective: "implementar auth",
          missionKind: MissionKind.EXECUTE,
          ownerEmployeeId: "cto-mag",
          requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
          parentMissionId: "root-1",
          resultJson: {
            phase: "executed",
            employeeResult: specialist,
          },
          startedAt: "2026-07-28T12:01:00.000Z",
          finishedAt: "2026-07-28T12:03:00.000Z",
        },
        {
          id: "consol-1",
          status: "COMPLETED",
          workspaceId: "nexo",
          objective: "[CONSOLIDATE]",
          missionKind: MissionKind.CONSOLIDATE,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          requiredSpecialization: null,
          parentMissionId: "root-1",
          resultJson: { phase: "consolidated", usableResult: "x", final },
          startedAt: null,
          finishedAt: "2026-07-28T12:05:00.000Z",
        },
      ],
      workspaceName: "NEXO",
    });

    expect(run.mission.initial.output.decision.delegations).toHaveLength(1);
    expect(run.mission.outcomes).toHaveLength(1);
    expect(run.mission.outcomes[0]?.matched).toBe(true);
    expect(run.mission.outcomes[0]?.employeeId).toBe("cto-mag");
    expect(run.mission.outcomes[0]?.result?.output.report.summary).toBe(
      "Auth entregue",
    );
    expect(run.mission.final.output.decision.decision).toBe("seguir");
    expect(run.reply.employeeId).toBe(CEO_EMPLOYEE_ID);
  });

  it("Caso 3: EXECUTE unmatched — sem especialista inventado + gap", () => {
    const initial = storedCeo({
      decision: "delegar",
      delegations: [
        {
          specialization: Specialization.SOFTWARE_ENGINEERING,
          reason: "tecnico",
          task: "auth",
        },
      ],
    });
    const final = storedCeo({ summary: "parcial" });

    const run = projectMissionTreeToOperationalRun({
      root: rootNode({
        resultJson: {
          phase: "consolidated",
          initial,
          usableResult: "parcial",
          final,
        },
      }),
      children: [
        {
          id: "exec-unmatched",
          status: "COMPLETED",
          workspaceId: "nexo",
          objective: "auth",
          missionKind: MissionKind.EXECUTE,
          ownerEmployeeId: "unmatched",
          requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
          parentMissionId: "root-1",
          resultJson: null,
          startedAt: null,
          finishedAt: null,
        },
      ],
      workspaceName: "NEXO",
    });

    expect(run.mission.outcomes).toHaveLength(1);
    expect(run.mission.outcomes[0]?.matched).toBe(false);
    expect(run.mission.outcomes[0]?.employeeId).toBeUndefined();
    expect(run.gaps.some((g) => g.code === "MISSING_SPECIALIST")).toBe(true);
  });

  it("Caso 4: missao incompleta — erro tipado", () => {
    expect(() =>
      projectMissionTreeToOperationalRun({
        root: rootNode({
          status: "WAITING",
          resultJson: { phase: "coordinated", initial: storedCeo() },
        }),
        children: [],
        workspaceName: "NEXO",
      }),
    ).toThrow(MissionTreeProjectionError);

    try {
      projectMissionTreeToOperationalRun({
        root: rootNode({
          status: "WAITING",
          resultJson: { phase: "coordinated", initial: storedCeo() },
        }),
        children: [],
        workspaceName: "NEXO",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(MissionTreeProjectionError);
      expect((error as MissionTreeProjectionError).code).toBe("NOT_COMPLETED");
    }

    expect(() =>
      projectMissionTreeToOperationalRun({
        root: rootNode({
          resultJson: {
            phase: "consolidated",
            usableResult: "x",
            final: storedCeo(),
            // sem initial
          },
        }),
        children: [],
        workspaceName: "NEXO",
      }),
    ).toThrow(/initial/);

    try {
      projectMissionTreeToOperationalRun({
        root: rootNode({
          resultJson: {
            phase: "consolidated",
            usableResult: "x",
            final: storedCeo(),
          },
        }),
        children: [],
        workspaceName: "NEXO",
      });
    } catch (error) {
      expect((error as MissionTreeProjectionError).code).toBe(
        "INCOMPLETE_MISSION",
      );
    }
  });
});
