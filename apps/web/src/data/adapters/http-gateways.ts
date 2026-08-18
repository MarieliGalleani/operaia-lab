import type {
  EmployeeProfileDTO,
  EmployeeReplyDTO,
  EmployeeStatusDTO,
  MissionListItemDTO,
  OrchestrationEventDTO,
  SessionDTO,
  SessionStateDTO,
  WorkflowDTO,
  WorkspaceDTO,
  WorkspaceTaskDTO,
} from "@/data/dto";
import { toEventFromMission } from "@/data/mappers";
import type { OfficeGateways } from "@/data/gateways/office-gateways";
import { createHttpClient, type HttpClient } from "./http-client";

function missionsQuery(workspaceId?: string): string {
  const params = new URLSearchParams({
    format: "flat",
    take: "20",
  });
  if (workspaceId) {
    params.set("workspaceId", workspaceId);
  }
  return `/missions?${params.toString()}`;
}

async function listMissionsAsEvents(
  client: HttpClient,
  workspaceId?: string,
): Promise<readonly OrchestrationEventDTO[]> {
  try {
    const payload = await client.get<{ missions: MissionListItemDTO[] }>(
      missionsQuery(workspaceId),
    );
    const missions = payload.missions ?? [];
    return missions
      .filter((mission) => mission.missionKind !== "CONSOLIDATE")
      .map(toEventFromMission);
  } catch (error) {
    console.log("[office-http] falha ao listar missoes para o feed", error);
    return [];
  }
}

/**
 * Adapters HTTP contra a API real da Equipe Digital.
 * Caminho principal do escritorio virtual — sem mocks.
 */
export function createHttpGateways(
  client: HttpClient = createHttpClient(),
): OfficeGateways {
  return {
    workspaces: {
      listWorkspaces: () => client.get<WorkspaceDTO[]>("/workspaces"),
      getWorkspace: (id) => client.get<WorkspaceDTO>(`/workspaces/${id}`),
      listTasks: async (workspaceId) => {
        if (workspaceId) {
          return client.get<WorkspaceTaskDTO[]>(
            `/workspaces/${workspaceId}/tasks`,
          );
        }
        const workspaces = await client.get<WorkspaceDTO[]>("/workspaces");
        const nested = await Promise.all(
          workspaces.map((workspace) =>
            client.get<WorkspaceTaskDTO[]>(
              `/workspaces/${workspace.id}/tasks`,
            ),
          ),
        );
        return nested.flat();
      },
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
      getWorkflow: async (workspaceId) => {
        try {
          return await client.get<WorkflowDTO>(
            `/workspaces/${workspaceId}/workflow`,
          );
        } catch {
          return undefined;
        }
      },
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
      listEvents: async (workspaceId) => {
        if (workspaceId) {
          try {
            const events = await client.get<OrchestrationEventDTO[]>(
              `/workspaces/${workspaceId}/events`,
            );
            if (events.length > 0) {
              return events;
            }
          } catch (error) {
            console.log(
              "[office-http] events do workspace vazios, usando missoes",
              workspaceId,
              error,
            );
          }
          return listMissionsAsEvents(client, workspaceId);
        }
        return listMissionsAsEvents(client);
      },
    },
  };
}
