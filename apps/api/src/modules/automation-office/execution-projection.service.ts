import { prisma, MissionStatus } from "@operaia/database";
import { NotFoundError } from "@operaia/shared";
import type {
  ExecutionStatus,
  ExecutionStepStatus,
  RiskLevel,
} from "./automation-office.types.js";
import {
  ADMIN_OFFICIAL_WORKSPACE_IDS,
  isOfficialWorkspaceId,
} from "../auth/official-workspace-access.js";
import {
  officialWorkspaceFilter,
  resolveWorkspaceName,
} from "./workspace-catalog.js";

export function mapMissionStatusToExecution(
  status: MissionStatus,
): ExecutionStatus {
  switch (status) {
    case MissionStatus.CREATED:
    case MissionStatus.QUEUED:
      return "PENDING";
    case MissionStatus.RUNNING:
      return "RUNNING";
    case MissionStatus.WAITING:
      return "WAITING_APPROVAL";
    case MissionStatus.COMPLETED:
      return "SUCCESS";
    case MissionStatus.FAILED:
      return "FAILED";
    case MissionStatus.CANCELLED:
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

function mapEventToStepStatus(type: string): ExecutionStepStatus {
  const lower = type.toLowerCase();
  if (lower.includes("fail") || lower.includes("error")) {
    return "failed";
  }
  if (lower.includes("run") || lower.includes("start")) {
    return "running";
  }
  if (lower.includes("wait")) {
    return "waiting";
  }
  if (lower.includes("skip")) {
    return "skipped";
  }
  if (lower.includes("complete") || lower.includes("ok")) {
    return "ok";
  }
  return "pending";
}

function missionToListItem(mission: {
  readonly id: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly status: MissionStatus;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
}) {
  return {
    id: mission.id,
    automationId: "core-mission",
    automationName: "Missão Core",
    workspaceId: mission.workspaceId,
    workspaceName: resolveWorkspaceName(mission.workspaceId),
    status: mapMissionStatusToExecution(mission.status),
    startedAt: (mission.startedAt ?? mission.finishedAt ?? new Date()).toISOString(),
    finishedAt: mission.finishedAt?.toISOString() ?? null,
  };
}

export async function listExecutions(workspaceId?: string) {
  const filter = officialWorkspaceFilter(workspaceId);
  const missions = await prisma.mission.findMany({
    where: {
      ...filter,
      parentMissionId: null,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      workspaceId: true,
      objective: true,
      status: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  return missions
    .filter((mission) => isOfficialWorkspaceId(mission.workspaceId))
    .map(missionToListItem);
}

export async function getExecutionById(id: string, workspaceId?: string) {
  const mission = await prisma.mission.findFirst({
    where: {
      id,
      ...officialWorkspaceFilter(workspaceId),
    },
  });

  if (!mission || !isOfficialWorkspaceId(mission.workspaceId)) {
    throw new NotFoundError("Execution", id);
  }

  const events = await prisma.missionEvent.findMany({
    where: { missionId: mission.id },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const steps = events.map((event, index) => {
    const status = mapEventToStepStatus(event.type);
    const payload =
      event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : {};
    const error =
      typeof payload.error === "string"
        ? payload.error
        : status === "failed"
          ? event.message
          : undefined;
    const resultSummary =
      typeof payload.summary === "string" ? payload.summary : event.message;

    return {
      id: event.id,
      label: event.message.slice(0, 120),
      status,
      responsibleLabel: "Opera",
      durationMs: undefined,
      resultSummary: status === "ok" ? resultSummary : undefined,
      error,
      canRetry: status === "failed",
      nextStepLabel:
        index < events.length - 1
          ? events[index + 1]?.message.slice(0, 80)
          : undefined,
    };
  });

  const timeline =
    steps.length > 0
      ? steps
      : [
          {
            id: `${mission.id}-root`,
            label: mission.objective.slice(0, 120),
            status: mapEventToStepStatus(mission.status),
            responsibleLabel: "Opera",
            durationMs: undefined,
            resultSummary:
              mission.status === MissionStatus.COMPLETED ? "Concluída" : undefined,
            error: mission.lastError ?? undefined,
            canRetry: mission.status === MissionStatus.FAILED,
            nextStepLabel: undefined,
          },
        ];

  return {
    ...missionToListItem(mission),
    triggerLabel: "Demanda / Core",
    steps: timeline,
  };
}

export async function countOpenMissions(workspaceId: string) {
  return prisma.mission.count({
    where: {
      workspaceId,
      status: {
        in: [
          MissionStatus.CREATED,
          MissionStatus.QUEUED,
          MissionStatus.RUNNING,
          MissionStatus.WAITING,
        ],
      },
    },
  });
}

export function defaultMissionRisk(): RiskLevel {
  return "MEDIUM";
}

export async function listInProgressMissions(take = 6) {
  const missions = await prisma.mission.findMany({
    where: {
      workspaceId: { in: [...ADMIN_OFFICIAL_WORKSPACE_IDS] },
      status: {
        in: [
          MissionStatus.RUNNING,
          MissionStatus.QUEUED,
          MissionStatus.WAITING,
        ],
      },
    },
    orderBy: { startedAt: "desc" },
    take,
    select: {
      id: true,
      workspaceId: true,
      objective: true,
      status: true,
      startedAt: true,
    },
  });

  return missions.map((mission) => ({
    id: mission.id,
    workspaceId: mission.workspaceId,
    workspaceName: resolveWorkspaceName(mission.workspaceId),
    objective: mission.objective.slice(0, 160),
    stepLabel:
      mission.status === MissionStatus.RUNNING
        ? "Em execução"
        : mission.status === MissionStatus.WAITING
          ? "Aguardando"
          : "Na fila",
    progressLabel: "Missão ativa",
    risk: defaultMissionRisk(),
    href: `/app/missions/${mission.id}`,
  }));
}
