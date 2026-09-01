import type { HttpClient } from "./http-client";
import { createHttpClient } from "./http-client";
import type {
  CreateMissionBody,
  CreateMissionResponse,
  MissionDetailDTO,
  MissionTreeNodeDTO,
} from "@/data/mission-contracts";
import type { MissionListItemDTO } from "@/data/dto";

export interface MissionsClient {
  listTree(
    take?: number,
    workspaceId?: string,
  ): Promise<readonly MissionTreeNodeDTO[]>;
  getById(id: string): Promise<MissionDetailDTO>;
  create(body: CreateMissionBody): Promise<CreateMissionResponse>;
  /** Missões (formato flat) de um employee — usa ownerEmployeeId (P1.14A/E). */
  listByOwner(ownerEmployeeId: string): Promise<readonly MissionListItemDTO[]>;
}

/**
 * Cliente do contrato operacional cru (F7.2.1):
 * POST /missions e GET /missions — não usa /operations/missions.
 */
export function createMissionsClient(
  client: HttpClient = createHttpClient(),
): MissionsClient {
  return {
    async listTree(
      take = 50,
      workspaceId?: string,
    ): Promise<readonly MissionTreeNodeDTO[]> {
      const qs = workspaceId
        ? `&workspaceId=${encodeURIComponent(workspaceId)}`
        : "";
      const payload = await client.get<{ tree: MissionTreeNodeDTO[] }>(
        `/missions?format=tree&take=${take}${qs}`,
      );
      return payload.tree ?? [];
    },

    async getById(id: string): Promise<MissionDetailDTO> {
      return client.get<MissionDetailDTO>(`/missions/${id}`);
    },

    async create(body: CreateMissionBody): Promise<CreateMissionResponse> {
      return client.post<CreateMissionResponse>("/missions", {
        workspaceId: body.workspaceId,
        objective: body.objective,
      });
    },

    async listByOwner(
      ownerEmployeeId: string,
    ): Promise<readonly MissionListItemDTO[]> {
      const payload = await client.get<{ missions: MissionListItemDTO[] }>(
        `/missions?format=flat&take=50&ownerEmployeeId=${encodeURIComponent(ownerEmployeeId)}`,
      );
      return payload.missions ?? [];
    },
  };
}
