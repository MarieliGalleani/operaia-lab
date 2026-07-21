import type { Pagination, UUID } from "@operaia/shared";
import type { Agent } from "./agent.entity.js";

export interface CreateAgentInput {
  name: string;
  role: string;
  description?: string | null;
  systemInstructions: string;
  active?: boolean;
}

export interface UpdateAgentInput {
  name?: string;
  role?: string;
  description?: string | null;
  systemInstructions?: string;
  active?: boolean;
}

/**
 * Contrato de persistencia de Agent.
 * Definido no dominio; implementado na infraestrutura.
 */
export interface AgentRepository {
  create(input: CreateAgentInput): Promise<Agent>;
  findById(id: UUID): Promise<Agent | null>;
  findAll(pagination?: Pagination): Promise<Agent[]>;
  update(id: UUID, input: UpdateAgentInput): Promise<Agent>;
  delete(id: UUID): Promise<void>;
}
