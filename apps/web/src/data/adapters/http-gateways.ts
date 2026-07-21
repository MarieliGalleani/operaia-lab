import type {
  EmployeeProfileDTO,
  EmployeeReplyDTO,
  EmployeeStatusDTO,
  OrchestrationEventDTO,
  SessionDTO,
  SessionStateDTO,
  WorkflowDTO,
  WorkspaceDTO,
  WorkspaceTaskDTO,
} from "@/data/dto";
import type { OfficeGateways } from "@/data/gateways/office-gateways";
import { createHttpClient, type HttpClient } from "./http-client";

/**
 * Adapters HTTP contra a API real. As sessões já existem hoje
 * (`/workspaces/:id/sessions`); os demais endpoints seguem o mesmo padrão e
 * serão habilitados quando expostos pelo backend — a troca é apenas ligar
 * `VITE_USE_REAL_API=true`, sem alterar componentes.
 */
export function createHttpGateways(
  client: HttpClient = createHttpClient(),
): OfficeGateways {
  return {
    workspaces: {
      listWorkspaces: () => client.get<WorkspaceDTO[]>("/workspaces"),
      getWorkspace: (id) => client.get<WorkspaceDTO>(`/workspaces/${id}`),
      listTasks: (workspaceId) =>
        client.get<WorkspaceTaskDTO[]>(
          workspaceId ? `/workspaces/${workspaceId}/tasks` : "/tasks",
        ),
    },

    registry: {
      listProfiles: () => client.get<EmployeeProfileDTO[]>("/employees"),
      getProfile: (id) => client.get<EmployeeProfileDTO>(`/employees/${id}`),
    },

    runtime: {
      getStatuses: () => client.get<EmployeeStatusDTO[]>("/employees/statuses"),
      ask: (employeeId, workspaceId, question) =>
        client.post<EmployeeReplyDTO>(`/employees/${employeeId}/ask`, {
          workspaceId,
          question,
        }),
      getWorkflow: (workspaceId) =>
        client.get<WorkflowDTO>(`/workspaces/${workspaceId}/workflow`),
    },

    sessions: {
      async startSession(workspaceId, objective): Promise<SessionDTO> {
        const created = await client.post<{
          sessionId: string;
          status: string;
          currentCycle: number;
        }>(`/workspaces/${workspaceId}/sessions`, { objective });
        return {
          id: created.sessionId,
          workspaceId,
          objective,
          status: created.status,
          currentCycle: created.currentCycle,
          startedAt: new Date().toISOString(),
          finishedAt: null,
        };
      },
      getSession: (workspaceId, sessionId) =>
        client.get<SessionStateDTO>(
          `/workspaces/${workspaceId}/sessions/${sessionId}`,
        ),
      listSessions: (workspaceId) =>
        client.get<SessionDTO[]>(`/workspaces/${workspaceId}/sessions`),
    },

    events: {
      listEvents: (workspaceId) =>
        client.get<OrchestrationEventDTO[]>(
          workspaceId ? `/workspaces/${workspaceId}/events` : "/events",
        ),
    },
  };
}
