import { NotFoundError, type Pagination, type UUID } from "@operaia/shared";
import type { Agent } from "../domain/agent.entity.js";
import type {
  AgentRepository,
  CreateAgentInput,
  UpdateAgentInput,
} from "../domain/agent.repository.js";

/** Casos de uso do modulo de gestao de agentes. */
export class AgentService {
  constructor(private readonly repository: AgentRepository) {}

  create(input: CreateAgentInput): Promise<Agent> {
    return this.repository.create(input);
  }

  list(pagination?: Pagination): Promise<Agent[]> {
    return this.repository.findAll(pagination);
  }

  async getById(id: UUID): Promise<Agent> {
    const agent = await this.repository.findById(id);
    if (!agent) {
      throw new NotFoundError("Agente", id);
    }
    return agent;
  }

  async update(id: UUID, input: UpdateAgentInput): Promise<Agent> {
    await this.getById(id);
    return this.repository.update(id, input);
  }

  async remove(id: UUID): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
