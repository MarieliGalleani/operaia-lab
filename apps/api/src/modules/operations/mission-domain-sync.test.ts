import { Specialization } from "@operaia/employee-framework";
import type { DelegationOutcome } from "@operaia/employee-runtime";
import { TaskStatus } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { buildDomainSyncActions } from "./mission-domain-sync.js";

function outcome(overrides: {
  readonly task?: string;
  readonly employeeId?: string;
  readonly matched?: boolean;
}): DelegationOutcome {
  return {
    matched: overrides.matched ?? true,
    request: {
      specialization: Specialization.SOFTWARE_ENGINEERING,
      reason: "executar",
      task: overrides.task,
    },
    employeeId: overrides.matched === false ? undefined : (overrides.employeeId ?? "cto-mag"),
  };
}

describe("mission-domain-sync", () => {
  const tasks = [
    {
      id: "task-auth",
      title: "Implementar autenticacao",
      status: TaskStatus.TODO,
      impact: 5,
      urgency: 5,
    },
    {
      id: "task-sync",
      title: "Sincronizar dados offline",
      status: TaskStatus.TODO,
      impact: 4,
      urgency: 3,
    },
  ];

  it("gera UPDATE_TASK IN_PROGRESS para tarefa delegada", () => {
    const actions = buildDomainSyncActions({
      outcomes: [outcome({ task: "Implementar autenticacao" })],
      workspaceTasks: tasks,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe("UPDATE_TASK");
    expect(actions[0]?.payload).toMatchObject({
      taskId: "task-auth",
      status: TaskStatus.IN_PROGRESS,
      employeeId: "cto-mag",
    });
  });

  it("nao gera action para outcome sem match", () => {
    const actions = buildDomainSyncActions({
      outcomes: [outcome({ matched: false })],
      workspaceTasks: tasks,
    });
    expect(actions).toHaveLength(0);
  });

  it("nao regride tarefa ja IN_PROGRESS ou DONE", () => {
    const actions = buildDomainSyncActions({
      outcomes: [outcome({ task: "Implementar autenticacao" })],
      workspaceTasks: [
        { ...tasks[0]!, status: TaskStatus.IN_PROGRESS },
        tasks[1]!,
      ],
    });
    expect(actions).toHaveLength(0);
  });
});
