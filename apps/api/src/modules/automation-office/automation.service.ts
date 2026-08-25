import { prisma } from "@operaia/database";
import { NotFoundError } from "@operaia/shared";
import type {
  AutomationStatus,
  AutonomyLevel,
  ExecutionStatus,
  RiskLevel,
} from "./automation-office.types.js";
import {
  officialWorkspaceFilter,
  resolveWorkspaceName,
} from "./workspace-catalog.js";

function triggerLabel(triggerType: string, config: unknown): string {
  if (triggerType === "schedule") {
    return "Agendamento";
  }
  if (triggerType === "signal") {
    return "Sinal de domínio";
  }
  if (triggerType === "manual") {
    return "Manual";
  }
  const cfg =
    config && typeof config === "object"
      ? (config as Record<string, unknown>)
      : {};
  return typeof cfg.label === "string" ? cfg.label : triggerType;
}

function toListItem(row: {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly workspaceId: string;
  readonly status: string;
  readonly triggerType: string;
  readonly triggerConfigJson: unknown;
  readonly autonomy: string;
  readonly risk: string;
  readonly lastExecutionAt: Date | null;
  readonly lastExecutionMissionId: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    workspaceId: row.workspaceId,
    workspaceName: resolveWorkspaceName(row.workspaceId),
    status: row.status as AutomationStatus,
    triggerLabel: triggerLabel(row.triggerType, row.triggerConfigJson),
    autonomy: row.autonomy as AutonomyLevel,
    risk: row.risk as RiskLevel,
    lastExecutionAt: row.lastExecutionAt?.toISOString() ?? null,
    lastSuccess:
      row.lastExecutionMissionId != null ? true : null,
  };
}

export async function listAutomations(workspaceId?: string) {
  const rows = await prisma.officeAutomation.findMany({
    where: officialWorkspaceFilter(workspaceId),
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(toListItem);
}

export async function getAutomationById(id: string, workspaceId?: string) {
  const row = await prisma.officeAutomation.findFirst({
    where: {
      id,
      ...officialWorkspaceFilter(workspaceId),
    },
  });
  if (!row) {
    throw new NotFoundError("Automation", id);
  }

  const actions = Array.isArray(row.actionsJson)
    ? (row.actionsJson as string[])
    : [];

  const history =
    row.lastExecutionMissionId != null
      ? [
          {
            executionId: row.lastExecutionMissionId,
            at: row.lastExecutionAt?.toISOString() ?? new Date().toISOString(),
            status: "SUCCESS" as ExecutionStatus,
          },
        ]
      : [];

  return {
    ...toListItem(row),
    actions,
    nextExecutionAt: row.nextExecutionAt?.toISOString() ?? null,
    history,
  };
}

export async function countActiveAutomations(workspaceId: string) {
  return prisma.officeAutomation.count({
    where: {
      workspaceId,
      status: { in: ["ACTIVE", "RUNNING", "READY"] },
    },
  });
}
