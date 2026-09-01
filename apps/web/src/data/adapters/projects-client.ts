import type { HttpClient } from "./http-client";
import { createHttpClient } from "./http-client";

export interface CreateProjectBody {
  readonly name: string;
  readonly objective?: string | null;
  readonly context?: string | null;
  readonly constraints?: string | null;
}

export interface UpdateProjectBody {
  readonly name?: string;
  readonly objective?: string | null;
  readonly context?: string | null;
  readonly constraints?: string | null;
}

export interface ProjectResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly priority: string;
  readonly objective: string | null;
  readonly context: string | null;
  readonly constraints: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectsClient {
  create(body: CreateProjectBody): Promise<ProjectResponse>;
  update(id: string, body: UpdateProjectBody): Promise<ProjectResponse>;
  getById(id: string): Promise<ProjectResponse>;
}

/**
 * Cliente do contrato cru de Project:
 * POST/GET/PATCH /projects — já existentes.
 * P1.14B: objective/context/constraints persistíveis (migration aditiva).
 */
export function createProjectsClient(
  client: HttpClient = createHttpClient(),
): ProjectsClient {
  return {
    async create(body: CreateProjectBody): Promise<ProjectResponse> {
      return client.post<ProjectResponse>("/projects", {
        name: body.name,
        objective: body.objective ?? undefined,
        context: body.context ?? undefined,
        constraints: body.constraints ?? undefined,
      });
    },

    async update(id: string, body: UpdateProjectBody): Promise<ProjectResponse> {
      return client.patch<ProjectResponse>(`/projects/${id}`, body);
    },

    async getById(id: string): Promise<ProjectResponse> {
      return client.get<ProjectResponse>(`/projects/${id}`);
    },
  };
}
