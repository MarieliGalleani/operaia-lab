import { randomUUID } from "node:crypto";
import type { EmployeeTask } from "@operaia/employee-framework";
import type { DelegationOutcome } from "@operaia/employee-runtime";
import {
  ActionStatus,
  ActionType,
  type Action,
} from "@operaia/execution-engine";
import { Priority, TaskStatus } from "@operaia/shared";

/**
 * Traduz entregas de especialistas em Actions de dominio (UPDATE_TASK).
 * Sem nomes de Employee — so Specialization + taskId do workspace.
 * Politica segura: apenas TODO/BLOCKED → IN_PROGRESS (nunca DONE automatico).
 */
export function buildDomainSyncActions(input: {
  readonly outcomes: readonly DelegationOutcome[];
  readonly workspaceTasks: readonly EmployeeTask[];
}): readonly Action[] {
  const actions: Action[] = [];
  const usedTaskIds = new Set<string>();

  for (const outcome of input.outcomes) {
    if (!outcome.matched || !outcome.employeeId) {
      continue;
    }

    const task = resolveTask(outcome, input.workspaceTasks);
    if (!task || usedTaskIds.has(task.id)) {
      continue;
    }
    if (task.status === TaskStatus.DONE || task.status === TaskStatus.IN_PROGRESS) {
      continue;
    }

    usedTaskIds.add(task.id);
    actions.push({
      id: randomUUID(),
      type: ActionType.UPDATE_TASK,
      description:
        `Avancar "${task.title}" apos especialidade ${outcome.request.specialization}`,
      payload: {
        taskId: task.id,
        title: task.title,
        status: TaskStatus.IN_PROGRESS,
        employeeId: outcome.employeeId,
        specialization: outcome.request.specialization,
      },
      priority: Priority.HIGH,
      status: ActionStatus.PENDING,
    });
  }

  return actions;
}

function resolveTask(
  outcome: DelegationOutcome,
  workspaceTasks: readonly EmployeeTask[],
): EmployeeTask | undefined {
  const requestedTitle = outcome.request.task?.trim();
  if (requestedTitle) {
    const byTitle = workspaceTasks.find(
      (task) =>
        task.title.toLowerCase() === requestedTitle.toLowerCase() &&
        task.status !== TaskStatus.DONE,
    );
    if (byTitle) {
      return byTitle;
    }
  }

  // Fallback: primeira pendencia do quadro (mesma regra da CEO priorizer).
  return workspaceTasks.find(
    (task) =>
      task.status === TaskStatus.TODO || task.status === TaskStatus.BLOCKED,
  );
}
