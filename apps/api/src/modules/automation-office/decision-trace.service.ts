import { prisma } from "@operaia/database";
import { NotFoundError } from "@operaia/shared";
import type {
  AutonomyLevel,
  ConfidenceLevel,
  RiskLevel,
} from "./automation-office.types.js";
import {
  officialWorkspaceFilter,
  resolveWorkspaceName,
} from "./workspace-catalog.js";

export async function createDecisionTrace(input: {
  readonly workspaceId: string;
  readonly missionId?: string;
  readonly objective: string;
  readonly context: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly chosenOptionId: string;
  readonly rationale: string;
  readonly risk: RiskLevel;
  readonly confidence: ConfidenceLevel;
  readonly autonomy: AutonomyLevel;
  readonly impact: string;
  readonly nextAction: string;
  readonly responsibleEmployeeId: string;
}) {
  return prisma.officeDecisionTrace.create({
    data: {
      workspaceId: input.workspaceId,
      missionId: input.missionId ?? null,
      objective: input.objective,
      context: input.context,
      optionsJson: input.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
      chosenOptionId: input.chosenOptionId,
      rationale: input.rationale,
      risk: input.risk,
      confidence: input.confidence,
      autonomy: input.autonomy,
      impact: input.impact,
      nextAction: input.nextAction,
      responsibleEmployeeId: input.responsibleEmployeeId,
    },
  });
}

function toDecisionDto(row: {
  readonly id: string;
  readonly workspaceId: string;
  readonly missionId: string | null;
  readonly objective: string;
  readonly context: string;
  readonly optionsJson: unknown;
  readonly chosenOptionId: string;
  readonly rationale: string;
  readonly risk: string;
  readonly confidence: string;
  readonly autonomy: string;
  readonly impact: string;
  readonly nextAction: string;
  readonly responsibleEmployeeId: string;
  readonly createdAt: Date;
}) {
  const options = Array.isArray(row.optionsJson)
    ? (row.optionsJson as { id: string; label: string }[])
    : [];

  return {
    decisionId: row.id,
    workspaceId: row.workspaceId,
    workspaceName: resolveWorkspaceName(row.workspaceId),
    missionId: row.missionId ?? undefined,
    objective: row.objective,
    context: row.context,
    options,
    chosenOptionId: row.chosenOptionId,
    rationale: row.rationale,
    risk: row.risk as RiskLevel,
    confidence: row.confidence as ConfidenceLevel,
    autonomy: row.autonomy as AutonomyLevel,
    impact: row.impact,
    nextAction: row.nextAction,
    responsibleEmployeeId: row.responsibleEmployeeId,
    responsibleLabel: "Opera",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDecisions(workspaceId?: string) {
  const rows = await prisma.officeDecisionTrace.findMany({
    where: officialWorkspaceFilter(workspaceId),
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(toDecisionDto);
}

export async function getDecisionById(id: string, workspaceId?: string) {
  const row = await prisma.officeDecisionTrace.findFirst({
    where: {
      id,
      ...officialWorkspaceFilter(workspaceId),
    },
  });
  if (!row) {
    throw new NotFoundError("Decision", id);
  }
  return toDecisionDto(row);
}

export async function listDecisionSummaries(
  workspaceIds: readonly string[],
  take = 5,
) {
  const rows = await prisma.officeDecisionTrace.findMany({
    where: { workspaceId: { in: [...workspaceIds] } },
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.objective.slice(0, 80),
    rationale: row.rationale,
    risk: row.risk as RiskLevel,
    confidence: row.confidence as ConfidenceLevel,
    autonomy: row.autonomy as AutonomyLevel,
    nextAction: row.nextAction,
    createdAt: row.createdAt.toISOString(),
    workspaceName: resolveWorkspaceName(row.workspaceId),
  }));
}

export async function countRecentDecisions(
  workspaceId: string,
  since: Date,
) {
  return prisma.officeDecisionTrace.count({
    where: {
      workspaceId,
      createdAt: { gte: since },
    },
  });
}
