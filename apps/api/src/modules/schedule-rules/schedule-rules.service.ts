import { prisma } from "@operaia/database";
import { NotFoundError } from "@operaia/shared";
import {
  assertOfficialWorkspace,
  officialWorkspaceFilter,
  resolveWorkspaceName,
} from "../automation-office/workspace-catalog.js";

interface ScheduleRuleConfig {
  readonly objective?: string;
}

interface ScheduleRuleRow {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly intervalSec: number;
  readonly enabled: boolean;
  readonly lastEnqueuedAt: Date | null;
  readonly configJson: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toDto(row: ScheduleRuleRow) {
  const config = (row.configJson ?? {}) as ScheduleRuleConfig;
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceId ? resolveWorkspaceName(row.workspaceId) : null,
    intervalSec: row.intervalSec,
    enabled: row.enabled,
    objective: config.objective ?? null,
    lastEnqueuedAt: row.lastEnqueuedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listScheduleRules(workspaceId?: string) {
  const rows = await prisma.scheduleRule.findMany({
    where: officialWorkspaceFilter(workspaceId),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

export async function createScheduleRule(input: {
  readonly workspaceId: string;
  readonly objective: string;
  readonly intervalSec: number;
  readonly enabled?: boolean;
}) {
  assertOfficialWorkspace(input.workspaceId);
  const row = await prisma.scheduleRule.create({
    data: {
      workspaceId: input.workspaceId,
      intervalSec: input.intervalSec,
      enabled: input.enabled ?? true,
      configJson: { objective: input.objective },
    },
  });
  return toDto(row);
}

async function findRuleOrThrow(id: string): Promise<ScheduleRuleRow> {
  const row = await prisma.scheduleRule.findUnique({ where: { id } });
  if (!row) {
    throw new NotFoundError("ScheduleRule", id);
  }
  if (row.workspaceId) {
    assertOfficialWorkspace(row.workspaceId);
  }
  return row;
}

export async function updateScheduleRule(
  id: string,
  input: {
    readonly objective?: string;
    readonly intervalSec?: number;
    readonly enabled?: boolean;
  },
) {
  const existing = await findRuleOrThrow(id);
  const existingConfig = (existing.configJson ?? {}) as ScheduleRuleConfig;

  const row = await prisma.scheduleRule.update({
    where: { id },
    data: {
      ...(input.intervalSec !== undefined
        ? { intervalSec: input.intervalSec }
        : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.objective !== undefined
        ? { configJson: { ...existingConfig, objective: input.objective } }
        : {}),
    },
  });
  return toDto(row);
}

export async function deleteScheduleRule(id: string): Promise<void> {
  await findRuleOrThrow(id);
  await prisma.scheduleRule.delete({ where: { id } });
}
