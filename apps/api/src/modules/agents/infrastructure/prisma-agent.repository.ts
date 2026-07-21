import { prisma, type Agent as PrismaAgent } from "@operaia/database";
import type { Pagination, UUID } from "@operaia/shared";
import type { Agent } from "../domain/agent.entity.js";
import type {
  AgentRepository,
  CreateAgentInput,
  UpdateAgentInput,
} from "../domain/agent.repository.js";

function toDomain(row: PrismaAgent): Agent {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    description: row.description,
    systemInstructions: row.systemInstructions,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaAgentRepository implements AgentRepository {
  async create(input: CreateAgentInput): Promise<Agent> {
    const row = await prisma.agent.create({ data: input });
    return toDomain(row);
  }

  async findById(id: UUID): Promise<Agent | null> {
    const row = await prisma.agent.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findAll(pagination?: Pagination): Promise<Agent[]> {
    const rows = await prisma.agent.findMany({
      orderBy: { createdAt: "asc" },
      skip: pagination?.skip,
      take: pagination?.take,
    });
    return rows.map(toDomain);
  }

  async update(id: UUID, input: UpdateAgentInput): Promise<Agent> {
    const row = await prisma.agent.update({ where: { id }, data: input });
    return toDomain(row);
  }

  async delete(id: UUID): Promise<void> {
    await prisma.agent.delete({ where: { id } });
  }
}
