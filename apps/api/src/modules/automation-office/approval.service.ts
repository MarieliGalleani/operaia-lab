import { prisma } from "@operaia/database";
import { ConflictError, NotFoundError } from "@operaia/shared";
import type { ApprovalStatus, RiskLevel } from "./automation-office.types.js";
import { createDecisionTrace } from "./decision-trace.service.js";
import {
  assertOfficialWorkspace,
  officialWorkspaceFilter,
  resolveWorkspaceName,
} from "./workspace-catalog.js";

export async function createApprovalForDemand(input: {
  readonly demandId: string;
  readonly workspaceId: string;
  readonly action: string;
  readonly risk: RiskLevel;
  readonly impact: string;
  readonly reason: string;
  readonly validated: readonly string[];
  readonly approveEffect: string;
  readonly rejectEffect: string;
  readonly officeDecision: string;
}) {
  assertOfficialWorkspace(input.workspaceId);
  return prisma.officeApprovalRequest.create({
    data: {
      demandId: input.demandId,
      workspaceId: input.workspaceId,
      action: input.action,
      risk: input.risk,
      impact: input.impact,
      reason: input.reason,
      validatedJson: [...input.validated],
      approveEffect: input.approveEffect,
      rejectEffect: input.rejectEffect,
      officeDecision: input.officeDecision,
      status: "PENDING",
    },
  });
}

export async function listApprovals(workspaceId?: string) {
  const rows = await prisma.officeApprovalRequest.findMany({
    where: officialWorkspaceFilter(workspaceId),
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.action,
    workspaceId: row.workspaceId,
    workspaceName: resolveWorkspaceName(row.workspaceId),
    risk: row.risk as RiskLevel,
    status: row.status as ApprovalStatus,
    createdAt: row.createdAt.toISOString(),
    actionSummary: row.action,
  }));
}

export async function getApprovalById(id: string, workspaceId?: string) {
  const row = await prisma.officeApprovalRequest.findFirst({
    where: {
      id,
      ...officialWorkspaceFilter(workspaceId),
    },
  });
  if (!row) {
    throw new NotFoundError("Approval", id);
  }

  const planSummary =
    row.demandId != null
      ? "Plano vinculado à demanda operacional."
      : "Sem plano vinculado.";

  const validated = Array.isArray(row.validatedJson)
    ? (row.validatedJson as string[])
    : [];

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    workspaceName: resolveWorkspaceName(row.workspaceId),
    action: row.action,
    risk: row.risk as RiskLevel,
    impact: row.impact,
    reason: row.reason,
    planSummary,
    validated,
    ifApprove: row.approveEffect,
    ifReject: row.rejectEffect,
    officeDecision: row.officeDecision,
    status: row.status as ApprovalStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

async function resolveApprovalAction(
  id: string,
  action: "approve" | "reject" | "modify",
  resolvedBy: string,
) {
  const row = await prisma.officeApprovalRequest.findUnique({
    where: { id },
  });
  if (!row) {
    throw new NotFoundError("Approval", id);
  }
  assertOfficialWorkspace(row.workspaceId);

  if (row.status !== "PENDING") {
    throw new ConflictError(`Aprovação já resolvida (${row.status}).`);
  }

  const statusMap = {
    approve: "APPROVED",
    reject: "REJECTED",
    modify: "MODIFIED",
  } as const;

  const nextStatus = statusMap[action];

  const updated = await prisma.officeApprovalRequest.update({
    where: { id },
    data: {
      status: nextStatus,
      resolvedAt: new Date(),
      resolvedBy,
    },
  });

  if (row.demandId) {
    if (action === "approve") {
      await prisma.officeDemand.update({
        where: { id: row.demandId },
        data: { status: "READY" },
      });
    } else if (action === "reject") {
      await prisma.officeDemand.update({
        where: { id: row.demandId },
        data: { status: "PAUSED" },
      });
    } else {
      await prisma.officeDemand.update({
        where: { id: row.demandId },
        data: { status: "PLANNED" },
      });
    }
  }

  await createDecisionTrace({
    workspaceId: row.workspaceId,
    objective: row.action,
    context: row.reason,
    options: [
      { id: "approve", label: "Aprovar" },
      { id: "reject", label: "Rejeitar" },
      { id: "modify", label: "Modificar" },
    ],
    chosenOptionId: action,
    rationale: `Ação humana registrada: ${action}.`,
    risk: row.risk as RiskLevel,
    confidence: "HIGH",
    autonomy: "HUMAN_APPROVAL",
    impact: row.impact,
    nextAction:
      action === "approve"
        ? "Demanda liberada para execução"
        : "Revisar demanda",
    responsibleEmployeeId: "opera",
  });

  return {
    source: "api" as const,
    backendDependency: false as const,
    status: updated.status as ApprovalStatus,
    message:
      action === "approve"
        ? "Aprovação registrada."
        : action === "reject"
          ? "Rejeição registrada."
          : "Modificação solicitada.",
  };
}

export async function approveApproval(id: string, resolvedBy: string) {
  return resolveApprovalAction(id, "approve", resolvedBy);
}

export async function rejectApproval(id: string, resolvedBy: string) {
  return resolveApprovalAction(id, "reject", resolvedBy);
}

export async function modifyApproval(id: string, resolvedBy: string) {
  return resolveApprovalAction(id, "modify", resolvedBy);
}

export async function countPendingApprovals(workspaceIds: readonly string[]) {
  return prisma.officeApprovalRequest.count({
    where: {
      workspaceId: { in: [...workspaceIds] },
      status: "PENDING",
    },
  });
}
