import { NotFoundError, type Pagination, type UUID } from "@operaia/shared";
import type { Project } from "../domain/project.entity.js";
import type {
  CreateProjectInput,
  ProjectRepository,
  UpdateProjectInput,
} from "../domain/project.repository.js";

/** Casos de uso do modulo de gestao de projetos. */
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  create(input: CreateProjectInput): Promise<Project> {
    return this.repository.create(input);
  }

  list(pagination?: Pagination): Promise<Project[]> {
    return this.repository.findAll(pagination);
  }

  async getById(id: UUID): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new NotFoundError("Projeto", id);
    }
    return project;
  }

  async update(id: UUID, input: UpdateProjectInput): Promise<Project> {
    await this.getById(id);
    return this.repository.update(id, input);
  }

  async remove(id: UUID): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
