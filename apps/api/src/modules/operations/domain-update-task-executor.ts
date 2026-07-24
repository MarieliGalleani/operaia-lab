import {
  ActionType,
  BaseActionExecutor,
  type Action,
  type ActionOutput,
} from "@operaia/execution-engine";
import { TaskStatus, type UUID } from "@operaia/shared";
import type { TaskRepository } from "../tasks/domain/task.repository.js";

/**
 * Executor de produto: UPDATE_TASK persiste no dominio via TaskRepository.
 * Sem FK de Employee Framework — so status (assignedAgentId fica fora nesta fase).
 */
export class DomainUpdateTaskExecutor extends BaseActionExecutor {
  readonly name = "task.update.domain";
  protected readonly type = ActionType.UPDATE_TASK;

  constructor(private readonly tasks: TaskRepository) {
    super();
  }

  async execute(action: Action): Promise<ActionOutput> {
    const taskId = String(action.payload["taskId"] ?? "").trim();
    const statusRaw = String(action.payload["status"] ?? "").trim();
    if (!taskId) {
      throw new Error("UPDATE_TASK requer payload.taskId");
    }
    if (!isTaskStatus(statusRaw)) {
      throw new Error(`UPDATE_TASK status invalido: ${statusRaw}`);
    }

    const existing = await this.tasks.findById(taskId as UUID);
    if (!existing) {
      throw new Error(`UPDATE_TASK: tarefa nao encontrada (${taskId})`);
    }

    // Nunca regride DONE; so avanca TODO/BLOCKED -> IN_PROGRESS nesta fase.
    if (existing.status === TaskStatus.DONE) {
      return {
        skipped: true,
        reason: "task_already_done",
        taskId: existing.id,
        status: existing.status,
      };
    }

    if (
      statusRaw === TaskStatus.IN_PROGRESS &&
      existing.status === TaskStatus.IN_PROGRESS
    ) {
      return {
        skipped: true,
        reason: "task_already_in_progress",
        taskId: existing.id,
        status: existing.status,
      };
    }

    const updated = await this.tasks.update(taskId as UUID, {
      status: statusRaw,
    });

    console.log("[domain-sync] UPDATE_TASK", {
      taskId: updated.id,
      title: updated.title,
      from: existing.status,
      to: updated.status,
      employeeId: action.payload["employeeId"],
    });

    return {
      updated: true,
      taskId: updated.id,
      title: updated.title,
      status: updated.status,
      employeeId: action.payload["employeeId"] ?? null,
    };
  }
}

function isTaskStatus(value: string): value is (typeof TaskStatus)[keyof typeof TaskStatus] {
  return Object.values(TaskStatus).includes(
    value as (typeof TaskStatus)[keyof typeof TaskStatus],
  );
}
