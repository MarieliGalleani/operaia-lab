import { prisma, MissionStatus, MissionKind } from "@operaia/database";
import type { ContinuousRuntime } from "../runtime/continuous-runtime.js";
import { ADMIN_OFFICIAL_WORKSPACE_IDS } from "../auth/official-workspace-access.js";
import { buildOfficeStatus } from "../office/build-office-status.js";
import { OfficeUnavailableError } from "./automation-office.errors.js";
import type {
  AttentionItemDto,
  CommandCenterDto,
  TeamMemberDto,
} from "./automation-office.types.js";
import { countPendingApprovals } from "./approval.service.js";
import { listDecisionSummaries } from "./decision-trace.service.js";
import { listInProgressMissions } from "./execution-projection.service.js";
import { resolveWorkspaceName } from "./workspace-catalog.js";

const ATTENTION_TAKE = 12;
const COMPLETED_TAKE = 8;

const SEVERITY_ORDER: Record<string, number> = {
  blocker: 0,
  critical: 1,
  warning: 2,
  info: 3,
};

async function buildTeam(
  runtime: ContinuousRuntime,
): Promise<readonly TeamMemberDto[]> {
  let snap: Awaited<ReturnType<ContinuousRuntime["snapshot"]>> | null = null;
  try {
    snap = await runtime.snapshot();
  } catch {
    return [];
  }

  const missionIds = snap.workers
    .map((worker) => worker.currentMissionId)
    .filter((id): id is string => id !== null);

  const objectiveById = new Map<string, string>();
  if (missionIds.length > 0) {
    const missions = await prisma.mission.findMany({
      where: { id: { in: missionIds } },
      select: { id: true, objective: true },
    });
    for (const mission of missions) {
      objectiveById.set(mission.id, mission.objective);
    }
  }

  return snap.workers.map((worker) => ({
    employeeId: worker.employeeId,
    name: worker.name,
    specialization: worker.specialization,
    status: worker.status,
    currentMissionId: worker.currentMissionId,
    currentObjective: worker.currentMissionId
      ? (objectiveById.get(worker.currentMissionId) ?? null)
      : null,
  }));
}

function extractDeliveryTitle(objective: string, resultJson: unknown): string {
  if (resultJson && typeof resultJson === "object") {
    const record = resultJson as Record<string, unknown>;
    if (typeof record.title === "string" && record.title.trim()) {
      return record.title.trim();
    }
    if (typeof record.summary === "string" && record.summary.trim()) {
      return record.summary.trim().slice(0, 120);
    }
  }
  return objective.slice(0, 120);
}

export async function buildCommandCenter(
  runtime: ContinuousRuntime,
): Promise<CommandCenterDto> {
  const statusPayload = await buildOfficeStatus(runtime);

  if (!statusPayload.status.healthOk || !statusPayload.status.readyOk) {
    throw new OfficeUnavailableError(
      "Command Center indisponível — dependências críticas falharam.",
      statusPayload.degradations,
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const officialIds = [...ADMIN_OFFICIAL_WORKSPACE_IDS];

  const [
    pendingApprovals,
    pendingApprovalRows,
    decisionSummaries,
    inProgress,
    completedMissions,
    team,
  ] = await Promise.all([
    countPendingApprovals(officialIds),
    prisma.officeApprovalRequest.findMany({
      where: {
        workspaceId: { in: officialIds },
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      take: ATTENTION_TAKE,
    }),
    listDecisionSummaries(officialIds, 5),
    listInProgressMissions(6),
    prisma.mission.findMany({
      where: {
        workspaceId: { in: officialIds },
        status: MissionStatus.COMPLETED,
        finishedAt: { gte: since },
        parentMissionId: null,
      },
      orderBy: { finishedAt: "desc" },
      take: COMPLETED_TAKE,
      select: {
        id: true,
        objective: true,
        finishedAt: true,
        missionKind: true,
        resultJson: true,
        workspaceId: true,
      },
    }),
    buildTeam(runtime),
  ]);

  const attention: AttentionItemDto[] = [];

  for (const approval of pendingApprovalRows) {
    attention.push({
      id: approval.id,
      kind: "approval",
      severity:
        approval.risk === "CRITICAL"
          ? "critical"
          : approval.risk === "HIGH"
            ? "warning"
            : "info",
      title: approval.action.slice(0, 80),
      detail: approval.reason,
      workspaceId: approval.workspaceId,
      workspaceName: resolveWorkspaceName(approval.workspaceId),
      risk: approval.risk as AttentionItemDto["risk"],
      href: `/app/command/approvals/${approval.id}`,
    });
  }

  for (const item of statusPayload.attention.items) {
    if (item.code === "needs_owner") {
      for (const proposal of statusPayload.humanAction.proposals) {
        attention.push({
          id: `structural-${proposal.id}`,
          kind: "decision",
          severity: "warning",
          title: `[Estrutural] ${proposal.title}`,
          detail: "ChangeProposal aguardando aprovação humana.",
          href: "/app/command/approvals",
        });
      }
      continue;
    }

    const kind =
      item.severity === "blocker" || item.code === "ready"
        ? "block"
        : item.code === "failed_new"
          ? "failure"
          : "risk";

    attention.push({
      id: `att-${item.code}`,
      kind,
      severity: item.severity,
      title: item.title,
      detail: item.detail,
      href: "/app/missions",
    });
  }

  attention.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
  );

  // Missao raiz e sempre dona da CEO (COORDINATE); quem realmente entregou
  // e o(s) especialista(s) cuja missao EXECUTE filha tem
  // resultJson.delivery.status === "DELIVERED" — o mesmo criterio que o
  // executor usa para gravar o evento delivery_created (ver
  // queued-mission-executor.ts:583 / mission-result-store.ts ExecutePhaseResult).
  // Sem esse sinal, nao ha como saber quem entregou de fato — nao adivinhamos.
  const completedIds = completedMissions.map(
    (mission: { id: string }) => mission.id,
  );
  const executeChildren = completedIds.length
    ? await prisma.mission.findMany({
        where: {
          parentMissionId: { in: completedIds },
          missionKind: MissionKind.EXECUTE,
        },
        select: {
          parentMissionId: true,
          ownerEmployeeId: true,
          resultJson: true,
        },
      })
    : [];
  const deliveredByMap = new Map<string, string[]>();
  for (const child of executeChildren) {
    if (!child.parentMissionId) {
      continue;
    }
    const resultJson = child.resultJson as { delivery?: { status?: string } } | null;
    if (resultJson?.delivery?.status !== "DELIVERED") {
      continue;
    }
    const existing = deliveredByMap.get(child.parentMissionId) ?? [];
    if (!existing.includes(child.ownerEmployeeId)) {
      existing.push(child.ownerEmployeeId);
    }
    deliveredByMap.set(child.parentMissionId, existing);
  }

  const completed = completedMissions.map((mission) => ({
    id: mission.id,
    title: extractDeliveryTitle(mission.objective, mission.resultJson),
    finishedAt: mission.finishedAt?.toISOString() ?? null,
    kind: mission.missionKind,
    href: `/app/missions/${mission.id}`,
    workspaceName: resolveWorkspaceName(mission.workspaceId),
    deliveredByEmployeeIds: deliveredByMap.get(mission.id) ?? [],
  }));

  const idle =
    statusPayload.activity.idle &&
    attention.length === 0 &&
    inProgress.length === 0;

  return {
    generatedAt: statusPayload.generatedAt,
    source: "api",
    backendDependency: false,
    status: {
      level: statusPayload.status.level,
      label: statusPayload.status.label,
      summary: statusPayload.status.summary,
      workers: statusPayload.status.workers,
    },
    attention: attention.slice(0, ATTENTION_TAKE),
    pendingApprovals,
    inProgress,
    decisions: decisionSummaries,
    completed,
    team,
    idle,
    zeroMessage:
      completed.length === 0
        ? "Seu escritório está em dia. Pronto para receber uma nova demanda."
        : "",
  };
}
