import type { Pagination, Priority, TaskStatus, UUID } from "@operaia/shared";
import type { Task } from "./task.entity.js";

export interface CreateTaskInput {
  projectId: UUID;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assignedAgentId?: UUID | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  assignedAgentId?: UUID | null;
}

export interface ListTasksFilter extends Pagination {
  projectId?: UUID;
  status?: TaskStatus;
  assignedAgentId?: UUID;
}

/**
 * Contrato de persistencia de Task.
 * Definido no dominio; implementado na infraestrutura.
 */
export interface TaskRepository {
  create(input: CreateTaskInput): Promise<Task>;
  findById(id: UUID): Promise<Task | null>;
  findAll(filter?: ListTasksFilter): Promise<Task[]>;
  update(id: UUID, input: UpdateTaskInput): Promise<Task>;
  delete(id: UUID): Promise<void>;
}
