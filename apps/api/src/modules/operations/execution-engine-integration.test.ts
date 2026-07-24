import { randomUUID } from "node:crypto";
import {
  ActionStatus,
  ActionType,
  AllowlistActionPolicy,
  ExecutionStatus,
  type Action,
} from "@operaia/execution-engine";
import { Priority } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { createLabRuntime } from "./lab-runtime.js";
import {
  buildMissionExecutionPlan,
  createMissionExecutionStack,
  executeMissionPlan,
} from "./mission-execution.js";

const NEXO_AUTH_OBJECTIVE = "Quero adicionar autenticação ao NEXO.";

function pendingAction(
  type: string,
  id = randomUUID(),
): Action {
  return {
    id,
    type,
    description: `acao ${type}`,
    payload: { id },
    priority: Priority.MEDIUM,
    status: ActionStatus.PENDING,
  };
}

describe("Digital Team Online — Fase 2.2 Execution Engine", () => {
  it("execução simples: LOG de auditoria via Policy → Registry → Executor", async () => {
    const stack = createMissionExecutionStack();
    const plan = buildMissionExecutionPlan({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
    });

    const { result, summaries } = await executeMissionPlan(stack, plan);

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.actionType).toBe(ActionType.LOG);
    expect(summaries[0]?.status).toBe(ActionStatus.SUCCESS);
    expect(typeof summaries[0]?.duration).toBe("number");
    expect(summaries[0]?.startedAt).toBeTruthy();
    expect(summaries[0]?.finishedAt).toBeTruthy();
  });

  it("múltiplas Actions no mesmo plano", async () => {
    const stack = createMissionExecutionStack();
    const plan = buildMissionExecutionPlan({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      extraActions: [
        pendingAction(ActionType.CREATE_TASK),
        pendingAction(ActionType.LOG),
      ],
    });

    const { result, summaries } = await executeMissionPlan(stack, plan);

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(summaries).toHaveLength(3);
    expect(summaries.map((s) => s.actionType)).toEqual([
      ActionType.LOG,
      ActionType.CREATE_TASK,
      ActionType.LOG,
    ]);
  });

  it("Action inválida (sem executor): FAILED controlado", async () => {
    const stack = createMissionExecutionStack();
    const plan = buildMissionExecutionPlan({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      extraActions: [pendingAction("UNKNOWN_EXTERNAL_TOOL")],
    });

    // Allowlist default só CREATE_TASK+LOG → UNKNOWN é SKIPPED pela policy
    const denied = await executeMissionPlan(stack, plan);
    expect(denied.summaries.some((s) => s.status === ActionStatus.SKIPPED)).toBe(
      true,
    );

    // Policy permissiva + tipo sem executor → FAILED
    const openStack = createMissionExecutionStack({
      policy: new AllowlistActionPolicy([
        ActionType.CREATE_TASK,
        ActionType.LOG,
        "UNKNOWN_EXTERNAL_TOOL",
      ]),
    });
    const { result, summaries } = await executeMissionPlan(openStack, plan);
    expect(result.status).toBe(ExecutionStatus.PARTIAL);
    const failed = summaries.find((s) => s.actionType === "UNKNOWN_EXTERNAL_TOOL");
    expect(failed?.status).toBe(ActionStatus.FAILED);
    expect(failed?.error).toBeTruthy();
  });

  it("Policy negando execução (SKIPPED)", async () => {
    const stack = createMissionExecutionStack({
      policy: new AllowlistActionPolicy([ActionType.CREATE_TASK]),
    });
    const plan = buildMissionExecutionPlan({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
    });

    const { summaries } = await executeMissionPlan(stack, plan);
    expect(summaries[0]?.actionType).toBe(ActionType.LOG);
    expect(summaries[0]?.status).toBe(ActionStatus.SKIPPED);
    expect(summaries[0]?.error).toContain("Policy negou");
  });

  it("normalização do resultado no contrato único", async () => {
    const stack = createMissionExecutionStack();
    const plan = buildMissionExecutionPlan({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      extraActions: [pendingAction(ActionType.CREATE_TASK)],
    });
    const { summaries } = await executeMissionPlan(stack, plan);
    const item = summaries[1]!;

    expect(item).toMatchObject({
      actionId: expect.any(String),
      actionType: ActionType.CREATE_TASK,
      status: ActionStatus.SUCCESS,
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
      duration: expect.any(Number),
    });
    expect(item.output).toBeDefined();
  });

  it("missão NEXO: CEO → Plan → Engine → Result → CEO → OperationalRun", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });

    expect(run.mission.outcomes.some((o) => o.employeeId === "cto-mag")).toBe(
      true,
    );
    expect(run.mission.final.employeeId).toBe("operaia-ceo");
    expect(run.execution.planId).toBe(run.mission.executionPlan.id);
    expect(run.execution.status).toBe(ExecutionStatus.SUCCESS);
    expect(run.execution.results.length).toBeGreaterThan(0);
    expect(run.execution.results[0]?.actionType).toBe(ActionType.LOG);
    expect(
      run.execution.results.some((item) => item.actionType === ActionType.UPDATE_TASK),
    ).toBe(true);
    expect(run.mission.final.briefing.additional?.executionResults).toBeDefined();
    expect(run.usableResult.length).toBeGreaterThan(0);
  });

  it("regressão Fase 2.1: Memory permanece no caminho oficial", async () => {
    const lab = createLabRuntime({ deterministic: true });
    const first = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
    });
    expect(first.execution.results.length).toBeGreaterThan(0);

    const second = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
    });
    expect(
      second.mission.initial.briefing.additional?.memoryContext,
    ).toBeDefined();
    expect(second.execution.status).toBe(ExecutionStatus.SUCCESS);
  });
});
