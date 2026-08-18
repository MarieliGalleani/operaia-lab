/**
 * Contratos HTTP de missão — espelham GET/POST /api/v1/missions (F7.1).
 * Sem campos inventados: só o que a API já devolve.
 */

export const MISSION_STATUSES = [
  "CREATED",
  "QUEUED",
  "RUNNING",
  "WAITING",
  "COMPLETED",
  "FAILED",
] as const;

export type MissionStatus = (typeof MISSION_STATUSES)[number] | string;

export const ACTIVE_MISSION_STATUSES = [
  "CREATED",
  "QUEUED",
  "RUNNING",
  "WAITING",
] as const;

export type ActiveMissionStatus = (typeof ACTIVE_MISSION_STATUSES)[number];

export function isActiveMissionStatus(status: string): boolean {
  return (ACTIVE_MISSION_STATUSES as readonly string[]).includes(status);
}

/** Nó de GET /missions?format=tree */
export interface MissionTreeNodeDTO {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly objective: string;
  readonly missionKind: string;
  readonly status: string;
  readonly ownerEmployeeId: string;
  readonly requiredSpecialization: string | null;
  readonly parentMissionId: string | null;
  readonly progress?: number;
  readonly attempt?: number;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly children: readonly MissionTreeNodeDTO[];
}

export interface MissionReplyDTO {
  readonly employeeId: string;
  readonly content: string;
  readonly answer?: {
    readonly summary?: string;
    readonly projects?: readonly string[];
    readonly risks?: readonly string[];
    readonly nextActions?: readonly string[];
  };
}

export interface MissionSpecialistDTO {
  readonly matched: boolean;
  readonly employeeId?: string;
  readonly specialization: string;
  readonly summary?: string;
}

export interface MissionChildDTO {
  readonly id: string;
  readonly status: string;
  readonly missionKind: string;
  readonly objective: string;
  readonly ownerEmployeeId: string;
  readonly requiredSpecialization: string | null;
  readonly parentMissionId: string | null;
  readonly finishedAt: string | null;
}

export interface MissionEventDTO {
  readonly id: string;
  readonly missionId: string;
  readonly type: string;
  readonly message: string;
  readonly createdAt: string;
  readonly payload?: unknown;
}

/** GET /api/v1/missions/:id — entrega persistida. */
export interface MissionDetailDTO {
  readonly id: string;
  readonly status: string;
  readonly objective: string;
  readonly workspaceId: string;
  readonly missionKind: string;
  readonly usableResult: string | null;
  readonly reply: MissionReplyDTO | null;
  readonly specialists: readonly MissionSpecialistDTO[];
  readonly children: readonly MissionChildDTO[];
  readonly events: readonly MissionEventDTO[];
}

export interface CreateMissionBody {
  readonly workspaceId: string;
  readonly objective: string;
}

export interface CreateMissionResponse {
  readonly created: boolean;
  readonly mission: {
    readonly id: string;
    readonly status?: string;
    readonly workspaceId?: string;
    readonly objective?: string;
    readonly ownerEmployeeId?: string;
  };
}
