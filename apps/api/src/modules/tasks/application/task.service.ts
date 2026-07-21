import { NotFoundError, type UUID } from "@operaia/shared";
import type { Task } from "../domain/task.entity.js";
import type {
  CreateTaskInput,
  ListTasksFilter,
  TaskRepository,
  UpdateTaskInput,
} from "../domain/task.repository.js";

/** Casos de uso do modulo de gestao de tarefas. */
export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  create(input: CreateTaskInput): Promise<Task> {
    return this.repository.create(input);
  }

  list(filter?: ListTasksFilter): Promise<Task[]> {
    return this.repository.findAll(filter);
  }

  async getById(id: UUID): Promise<Task> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new NotFoundError("Tarefa", id);
    }
    return task;
  }

  async update(id: UUID, input: UpdateTaskInput): Promise<Task> {
    await this.getById(id);
    return this.repository.update(id, input);
  }

  async remove(id: UUID): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
