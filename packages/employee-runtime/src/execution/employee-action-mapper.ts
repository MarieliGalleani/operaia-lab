import { randomUUID } from "node:crypto";
import type { EmployeeTask } from "@operaia/employee-framework";
import {
  ActionStatus,
  ActionType,
  type Action,
  type ExecutionPlan,
} from "@operaia/execution-engine";
import { Priority, TaskStatus } from "@operaia/shared";

const HIGH_THRESHOLD = 8;
const MEDIUM_THRESHOLD = 5;

/**
 * Traduz tarefas de NEGOCIO (EmployeeTask) em trabalho executavel (Action) para
 * o Execution Engine. E a fronteira EmployeeTask -> Actions do fluxo:
 * o funcionario nunca conhece Actions; o mapeamento vive aqui.
 */
export class EmployeeActionMapper {
  toActions(tasks: readonly EmployeeTask[]): Action[] {
    return tasks
      .filter((task) => task.status !== TaskStatus.DONE)
      .map((task) => ({
        id: randomUUID(),
        type: ActionType.CREATE_TASK,
        description: task.title,
        payload: { taskId: task.id, title: task.title, status: task.status },
        priority: resolvePriority(task),
        status: ActionStatus.PENDING,
      }));
  }

  toExecutionPlan(tasks: readonly EmployeeTask[]): ExecutionPlan {
    return {
      id: randomUUID(),
      actions: this.toActions(tasks),
      metadata: { source: "employee-runtime" },
    };
  }
}

/** Prioridade da Action derivada do peso (impacto + urgencia) da tarefa. */
function resolvePriority(task: EmployeeTask): Priority {
  const weight = (task.impact ?? 0) + (task.urgency ?? 0);
  if (weight >= HIGH_THRESHOLD) {
    return Priority.URGENT;
  }
  if (weight >= MEDIUM_THRESHOLD) {
    return Priority.HIGH;
  }
  if (weight > 0) {
    return Priority.MEDIUM;
  }
  return Priority.LOW;
}
