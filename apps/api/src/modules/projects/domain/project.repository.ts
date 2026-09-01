import type { Pagination, Priority, ProjectStatus, UUID } from "@operaia/shared";
import type { Project } from "./project.entity.js";

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  goalId?: string | null;
  objective?: string | null;
  context?: string | null;
  constraints?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: Priority;
  goalId?: string | null;
  objective?: string | null;
  context?: string | null;
  constraints?: string | null;
}

/**
 * Contrato de persistencia de Project.
 * Definido no dominio; implementado na infraestrutura (inversao de dependencia).
 */
export interface ProjectRepository {
  create(input: CreateProjectInput): Promise<Project>;
  findById(id: UUID): Promise<Project | null>;
  findByName(name: string): Promise<Project | null>;
  findAll(pagination?: Pagination): Promise<Project[]>;
  update(id: UUID, input: UpdateProjectInput): Promise<Project>;
  delete(id: UUID): Promise<void>;
}
