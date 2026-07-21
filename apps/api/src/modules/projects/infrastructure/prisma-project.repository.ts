import { prisma, type Project as PrismaProject } from "@operaia/database";
import type { Pagination, UUID } from "@operaia/shared";
import type { Project } from "../domain/project.entity.js";
import type {
  CreateProjectInput,
  ProjectRepository,
  UpdateProjectInput,
} from "../domain/project.repository.js";

function toDomain(row: PrismaProject): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaProjectRepository implements ProjectRepository {
  async create(input: CreateProjectInput): Promise<Project> {
    const row = await prisma.project.create({ data: input });
    return toDomain(row);
  }

  async findById(id: UUID): Promise<Project | null> {
    const row = await prisma.project.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findAll(pagination?: Pagination): Promise<Project[]> {
    const rows = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      skip: pagination?.skip,
      take: pagination?.take,
    });
    return rows.map(toDomain);
  }

  async update(id: UUID, input: UpdateProjectInput): Promise<Project> {
    const row = await prisma.project.update({ where: { id }, data: input });
    return toDomain(row);
  }

  async delete(id: UUID): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }
}
