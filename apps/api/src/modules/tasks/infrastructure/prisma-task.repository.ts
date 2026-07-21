import { prisma, type Task as PrismaTask } from "@operaia/database";
import type { UUID } from "@operaia/shared";
import type { Task } from "../domain/task.entity.js";
import type {
  CreateTaskInput,
  ListTasksFilter,
  TaskRepository,
  UpdateTaskInput,
} from "../domain/task.repository.js";

function toDomain(row: PrismaTask): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedAgentId: row.assignedAgentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaTaskRepository implements TaskRepository {
  async create(input: CreateTaskInput): Promise<Task> {
    const row = await prisma.task.create({ data: input });
    return toDomain(row);
  }

  async findById(id: UUID): Promise<Task | null> {
    const row = await prisma.task.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findAll(filter?: ListTasksFilter): Promise<Task[]> {
    const rows = await prisma.task.findMany({
      where: {
        projectId: filter?.projectId,
        status: filter?.status,
        assignedAgentId: filter?.assignedAgentId,
      },
      orderBy: { createdAt: "desc" },
      skip: filter?.skip,
      take: filter?.take,
    });
    return rows.map(toDomain);
  }

  async update(id: UUID, input: UpdateTaskInput): Promise<Task> {
    const row = await prisma.task.update({ where: { id }, data: input });
    return toDomain(row);
  }

  async delete(id: UUID): Promise<void> {
    await prisma.task.delete({ where: { id } });
  }
}
