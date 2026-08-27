/**
 * P0.3E — projection/read-model do Autonomy Loop (Office-only).
 *
 * Lê evidências já existentes no Core/Office. Não escreve VALIDATING,
 * não cria MissionEvent, não altera MissionQueue/QME/Gate.
 */
import { MissionKind, MissionStatus, prisma } from "@operaia/database";
import { NotFoundError } from "@operaia/shared";
import {
  extractDeliveryFromResultJson,
  isValidDelivery,
  treeHasValidResult,
} from "../runtime/work-governance/index.js";
import type {
  GovernanceMissionSnapshot,
  WorkIdentityKind,
} from "../runtime/work-governance/types.js";
import {
  assertOfficialWorkspace,
  officialWorkspaceFilter,
} from "./workspace-catalog.js";
import { reconcileDemandFromMission } from "./demand.service.js";

const VALIDATION_KINDS: readonly WorkIdentityKind[] = [
  "technical",
  "finance",
  "ux",
  "marketing",
  "product",
  "legal",
  "generic",
] as const;

export type AutonomyLoopStageId =
  | "intake"
  | "planning"
  | "delegation"
  | "mission"
  | "execution"
  | "validation"
  | "delivery";

export interface AutonomyLoopStageEvidence {
  readonly stage: AutonomyLoopStageId;
  readonly present: boolean;
  /** Se false e present=false, harness NÃO pode declarar PASS nesta etapa. */
  readonly summary: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface AutonomyLoopEvidence {
  readonly demandId: string;
  readonly correlationId: string;
  readonly missionId: string | null;
  readonly demandStatus: string;
  readonly gateDecision: string | null;
  readonly stages: readonly AutonomyLoopStageEvidence[];
  /** true somente se as 7 etapas têm evidência presente (ou delegation ausente documentada). */
  readonly loopEvidenceComplete: boolean;
}

function toSnapshot(row: {
  readonly id: string;
  readonly workspaceId: string;
  readonly status: MissionStatus;
  readonly missionKind: MissionKind;
  readonly objective: string;
  readonly resultJson: unknown;
  readonly parentMissionId: string | null;
}): GovernanceMissionSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    status: row.status,
    missionKind: row.missionKind,
    objective: row.objective,
    resultJson: row.resultJson,
    parentMissionId: row.parentMissionId,
  };
}

function hasValidResultOnTree(
  root: GovernanceMissionSnapshot,
  children: readonly GovernanceMissionSnapshot[],
): { readonly ok: boolean; readonly matchedKind: WorkIdentityKind | null } {
  for (const kind of VALIDATION_KINDS) {
    if (treeHasValidResult(root, children, kind)) {
      return { ok: true, matchedKind: kind };
    }
  }
  // Fallback: delivery DELIVERED com evidence genérica (isValidDelivery technical/generic)
  for (const node of [root, ...children]) {
    if (node.status !== "COMPLETED") continue;
    const delivery = extractDeliveryFromResultJson(node.resultJson);
    if (isValidDelivery(delivery, "technical", node.resultJson)) {
      return { ok: true, matchedKind: "technical" };
    }
    if (isValidDelivery(delivery, "generic", node.resultJson)) {
      return { ok: true, matchedKind: "generic" };
    }
  }
  return { ok: false, matchedKind: null };
}

/**
 * Monta evidência auditável do loop para uma Demand (correlation = demand.id).
 */
export async function buildAutonomyLoopEvidence(
  demandId: string,
  workspaceId?: string,
): Promise<AutonomyLoopEvidence> {
  const demand = await prisma.officeDemand.findFirst({
    where: {
      id: demandId,
      ...officialWorkspaceFilter(workspaceId),
    },
    include: {
      approvals: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true },
      },
    },
  });

  if (!demand) {
    throw new NotFoundError("Demand", demandId);
  }

  assertOfficialWorkspace(demand.workspaceId);

  // Lazy reconcile (idempotente) — não muta Mission.
  const reconciled = await reconcileDemandFromMission(demand);
  const liveDemand = reconciled.demand;
  const approvalRows = demand.approvals;

  const gate = await prisma.workGovernanceDecision.findFirst({
    where: { correlationId: demand.id },
    orderBy: { createdAt: "desc" },
    select: {
      decision: true,
      reason: true,
      resultingMissionId: true,
      createdAt: true,
    },
  });

  const missionId = liveDemand.missionId;
  let rootMission: {
    id: string;
    workspaceId: string;
    status: MissionStatus;
    missionKind: MissionKind;
    resultJson: unknown;
    parentMissionId: string | null;
    objective: string;
  } | null = null;
  let children: Array<{
    id: string;
    workspaceId: string;
    status: MissionStatus;
    missionKind: MissionKind;
    resultJson: unknown;
    parentMissionId: string | null;
    objective: string;
  }> = [];
  let events: Array<{ id: string; missionId: string; type: string; createdAt: Date }> =
    [];

  if (missionId) {
    rootMission = await prisma.mission.findUnique({
      where: { id: missionId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        missionKind: true,
        resultJson: true,
        parentMissionId: true,
        objective: true,
      },
    });

    if (rootMission) {
      children = await prisma.mission.findMany({
        where: { parentMissionId: rootMission.id },
        select: {
          id: true,
          workspaceId: true,
          status: true,
          missionKind: true,
          resultJson: true,
          parentMissionId: true,
          objective: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const treeIds = [rootMission.id, ...children.map((c) => c.id)];
      events = await prisma.missionEvent.findMany({
        where: { missionId: { in: treeIds } },
        select: { id: true, missionId: true, type: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 200,
      });
    }
  }

  const executeChildren = children.filter(
    (c) => c.missionKind === MissionKind.EXECUTE,
  );
  const hasDelegation = executeChildren.length > 0;
  const rootCompletedWithoutDelegation =
    rootMission?.status === MissionStatus.COMPLETED &&
    rootMission.missionKind === MissionKind.COORDINATE &&
    executeChildren.length === 0;

  const deliveryEvents = events.filter((e) => e.type === "delivery_created");
  const hasDeliveryCreated = deliveryEvents.length > 0;

  const rootSnap = rootMission
    ? toSnapshot(rootMission)
    : null;
  const childSnaps = children.map(toSnapshot);
  const validation = rootSnap
    ? hasValidResultOnTree(rootSnap, childSnaps)
    : { ok: false, matchedKind: null };

  const planJson = liveDemand.planJson;
  const hasPlan =
    planJson !== null &&
    typeof planJson === "object" &&
    Array.isArray((planJson as { steps?: unknown }).steps) &&
    ((planJson as { steps: unknown[] }).steps.length > 0 ||
      Object.keys(planJson as object).length > 0);

  const intakePresent =
    Boolean(liveDemand.id) &&
    liveDemand.status !== "DRAFT" &&
    liveDemand.objective.trim().length > 0;

  const planningPresent = hasPlan;

  const delegationPresent = hasDelegation || rootCompletedWithoutDelegation;

  const missionPresent = Boolean(missionId && rootMission);

  const executionPresent =
    Boolean(rootMission) &&
    (events.length > 0 ||
      rootMission!.status !== MissionStatus.CREATED ||
      children.length > 0);

  const validationPresent = validation.ok;

  const deliveryPresent = hasDeliveryCreated;

  const terminalDemand = ["COMPLETED", "FAILED", "CANCELLED"].includes(
    liveDemand.status,
  );
  const terminalMission =
    rootMission !== null &&
    (rootMission.status === MissionStatus.COMPLETED ||
      rootMission.status === MissionStatus.FAILED ||
      rootMission.status === MissionStatus.CANCELLED);

  const stages: AutonomyLoopStageEvidence[] = [
    {
      stage: "intake",
      present: intakePresent,
      summary: intakePresent
        ? `Demand ${liveDemand.id} status=${liveDemand.status}`
        : "Demand/intake ausente",
      details: {
        demandId: liveDemand.id,
        status: liveDemand.status,
        objective: liveDemand.objective.slice(0, 160),
        approvals: approvalRows.map((a) => ({
          id: a.id,
          status: a.status,
        })),
      },
    },
    {
      stage: "planning",
      present: planningPresent,
      summary: planningPresent
        ? "planJson presente"
        : "planJson ausente ou vazio",
      details: {
        hasPlanJson: planJson !== null,
        planJson,
      },
    },
    {
      stage: "delegation",
      present: delegationPresent,
      summary: hasDelegation
        ? `${executeChildren.length} child EXECUTE via parentMissionId`
        : rootCompletedWithoutDelegation
          ? "COORDINATE concluído sem children EXECUTE (delegation ausente documentada)"
          : "Sem children EXECUTE e sem finish COORDINATE documentado",
      details: {
        parentMissionId: rootMission?.id ?? null,
        executeChildren: executeChildren.map((c) => ({
          id: c.id,
          status: c.status,
          missionKind: c.missionKind,
        })),
        delegationAbsentDocumented: rootCompletedWithoutDelegation,
      },
    },
    {
      stage: "mission",
      present: missionPresent,
      summary: missionPresent
        ? `Mission ${missionId} kind=${rootMission?.missionKind}`
        : "missionId/Mission ausente",
      details: {
        missionId,
        missionKind: rootMission?.missionKind ?? null,
        missionStatus: rootMission?.status ?? null,
        gateDecision: gate?.decision ?? null,
        gateReason: gate?.reason ?? null,
        correlationId: demand.id,
      },
    },
    {
      stage: "execution",
      present: executionPresent,
      summary: executionPresent
        ? `${events.length} MissionEvent(s) na árvore`
        : "Sem evidência de execução (events/status)",
      details: {
        eventTypes: [...new Set(events.map((e) => e.type))],
        eventCount: events.length,
        rootStatus: rootMission?.status ?? null,
        childCount: children.length,
      },
    },
    {
      stage: "validation",
      present: validationPresent,
      summary: validationPresent
        ? `ValidResult/delivery validation OK (kind=${validation.matchedKind})`
        : "ValidResult/delivery validation não comprovada (Office NÃO escreve VALIDATING)",
      details: {
        matchedKind: validation.matchedKind,
        officeDemandNeverWritesValidating: true,
      },
    },
    {
      stage: "delivery",
      present: deliveryPresent,
      summary: deliveryPresent
        ? `${deliveryEvents.length} delivery_created`
        : "Nenhum MissionEvent delivery_created na árvore",
      details: {
        deliveryEventIds: deliveryEvents.map((e) => e.id),
        demandTerminal: terminalDemand,
        missionTerminal: terminalMission,
        demandStatus: liveDemand.status,
        missionStatus: rootMission?.status ?? null,
        reconcileReason: reconciled.reason,
      },
    },
  ];

  const loopEvidenceComplete = stages.every((s) => s.present);

  return {
    demandId: demand.id,
    correlationId: demand.id,
    missionId,
    demandStatus: liveDemand.status,
    gateDecision: gate?.decision ?? null,
    stages,
    loopEvidenceComplete,
  };
}
