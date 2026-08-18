import type { HttpClient } from "./http-client";
import { createHttpClient } from "./http-client";
import type {
  CreateMissionBody,
  CreateMissionResponse,
  MissionDetailDTO,
  MissionTreeNodeDTO,
} from "@/data/mission-contracts";

export interface MissionsClient {
  listTree(take?: number): Promise<readonly MissionTreeNodeDTO[]>;
  getById(id: string): Promise<MissionDetailDTO>;
  create(body: CreateMissionBody): Promise<CreateMissionResponse>;
}

/**
 * Cliente do contrato operacional cru (F7.2.1):
 * POST /missions e GET /missions — não usa /operations/missions.
 */
export function createMissionsClient(
  client: HttpClient = createHttpClient(),
): MissionsClient {
  return {
    async listTree(take = 50): Promise<readonly MissionTreeNodeDTO[]> {
      const payload = await client.get<{ tree: MissionTreeNodeDTO[] }>(
        `/missions?format=tree&take=${take}`,
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
  };
}
