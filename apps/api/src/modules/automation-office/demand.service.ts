import { MissionStatus, prisma } from "@operaia/database";
import { ConflictError, NotFoundError, ValidationError } from "@operaia/shared";
import type { AutonomyLevel, RiskLevel } from "./automation-office.types.js";
import { interpretDemandText } from "./demand-interpreter.js";
import { createDecisionTrace } from "./decision-trace.service.js";
import { createApprovalForDemand } from "./approval.service.js";
import {
  assertOfficialWorkspace,
  officialWorkspaceFilter,
  resolveWorkspaceName,
} from "./workspace-catalog.js";
import type { AutomationOfficeDeps } from "./automation-office.types.js";
import { submitDemandToCore } from "./submit-demand-to-core.js";

type OfficeDemandRow = Awaited<
  ReturnType<typeof prisma.officeDemand.findFirst>
>;

export type ReconcileDemandReason =
  | "not_executing"
  | "missing_mission_id"
  | "mission_not_found"
  | "mission_not_terminal"
  | "updated"
  | "already_synced";

export interface ReconcileDemandFromMissionResult {
  readonly demand: NonNullable<OfficeDemandRow>;
  readonly changed: boolean;
  readonly reason: ReconcileDemandReason;
  readonly missionStatus?: MissionStatus;
}

const TERMINAL_MISSION_TO_DEMAND = {
  [MissionStatus.COMPLETED]: "COMPLETED",
  [MissionStatus.FAILED]: "FAILED",
  [MissionStatus.CANCELLED]: "CANCELLED",
} as const;

/**
 * Lazy sync Demand ← Mission (P0.3C-5 Opção A).
 * Só fecha demandas EXECUTING; nunca muta Mission nem enfileira.
 */
export async function reconcileDemandFromMission(
  demand: NonNullable<OfficeDemandRow>,
): Promise<ReconcileDemandFromMissionResult> {
  if (demand.status !== "EXECUTING") {
    return { demand, changed: false, reason: "not_executing" };
  }

  if (!demand.missionId) {
    return { demand, changed: false, reason: "missing_mission_id" };
  }

  const mission = await prisma.mission.findUnique({
    where: { id: demand.missionId },
    select: { id: true, status: true },
  });

  if (!mission) {
    console.log(
      JSON.stringify({
        level: "warn",
        component: "automation-office",
        event: "reconcile_mission_not_found",
        demandId: demand.id,
        missionId: demand.missionId,
      }),
    );
    return { demand, changed: false, reason: "mission_not_found" };
  }

  const targetStatus =
    TERMINAL_MISSION_TO_DEMAND[
      mission.status as keyof typeof TERMINAL_MISSION_TO_DEMAND
    ];

  if (!targetStatus) {
    return {
      demand,
      changed: false,
      reason: "mission_not_terminal",
      missionStatus: mission.status,
    };
  }

  const resolvedAt = new Date();
  const updated = await prisma.officeDemand.updateMany({
    where: {
      id: demand.id,
      status: "EXECUTING",
      missionId: mission.id,
    },
    data: {
      status: targetStatus,
      resolvedAt,
    },
  });

  const fresh = await prisma.officeDemand.findFirst({
    where: { id: demand.id },
  });
  const nextDemand = fresh ?? demand;

  if (updated.count === 0) {
    return {
      demand: nextDemand,
      changed: false,
      reason: "already_synced",
      missionStatus: mission.status,
    };
  }

  return {
    demand: nextDemand,
    changed: true,
    reason: "updated",
    missionStatus: mission.status,
  };
}

export async function interpretDemand(input: {
  readonly text: string;
  readonly workspaceId: string;
}) {
  const workspaceId = assertOfficialWorkspace(input.workspaceId);
  const text = input.text.trim();
  if (!text) {
    throw new ValidationError("Texto da demanda não pode ser vazio.");
  }

  const demand = await prisma.officeDemand.create({
    data: {
      workspaceId,
      status: "INTERPRETING",
      objective: text,
    },
  });

  const interpreted = interpretDemandText({
    text,
    workspaceId,
    demandId: demand.id,
  });

  const updated = await prisma.officeDemand.update({
    where: { id: demand.id },
    data: {
      status: interpreted.targetStatus,
      objective: interpreted.brief.objective,
      context: interpreted.brief.context,
      expectedOutcome: interpreted.brief.expectedOutcome,
      constraintsJson: [...interpreted.brief.constraints],
      priority: interpreted.brief.priority,
      risk: interpreted.brief.risk,
      autonomy: interpreted.brief.autonomy,
      planJson: JSON.parse(JSON.stringify(interpreted.plan)),
    },
  });

  await createDecisionTrace({
    workspaceId,
    objective: interpreted.brief.objective,
    context: interpreted.brief.context,
    options: [
      { id: "plan", label: "Seguir plano proposto" },
      { id: "revise", label: "Revisar antes de executar" },
    ],
    chosenOptionId: "plan",
    rationale: "Plano operacional gerado a partir da demanda interpretada.",
    risk: interpreted.brief.risk,
    confidence: interpreted.brief.risk === "LOW" ? "HIGH" : "MEDIUM",
    autonomy: interpreted.brief.autonomy,
    impact: interpreted.brief.expectedOutcome,
    nextAction: interpreted.approvalNeeded
      ? "Aguardar aprovação humana"
      : "Pronta para execução",
    responsibleEmployeeId: "opera",
  });

  if (interpreted.approvalNeeded) {
    await createApprovalForDemand({
      demandId: updated.id,
      workspaceId,
      action: `Executar demanda: ${interpreted.brief.objective.slice(0, 80)}`,
      risk: interpreted.brief.risk,
      impact: interpreted.brief.expectedOutcome,
      reason: "Risco ou autonomia exige aprovação humana antes da execução.",
      validated: ["Plano operacional revisado", "Workspace autorizado"],
      approveEffect: "Demanda avançará para execução via Core.",
      rejectEffect: "Demanda permanece pausada até nova instrução.",
      officeDecision: "Recomendamos revisar o plano antes de aprovar.",
    });
  }

  return {
    source: "api" as const,
    backendDependency: false as const,
    brief: interpreted.brief,
    plan: interpreted.plan,
  };
}

/**
 * Pode executar agora? (corrige o fluxo do 1º andar)
 *
 * Antes so READY (autonomia "Autonomo") ou aprovacao concedida passavam.
 * Uma demanda de risco baixo/medio fica PLANNED e a tela deixa a usuaria
 * escolher "Controlado" e clicar em "Executar plano" — esse clique E a
 * confirmacao que o modo Controlado pede, mas a API devolvia 409.
 */
export function canExecuteDemand(input: {
  readonly status: string;
  readonly approved: boolean;
  readonly autonomy: AutonomyLevel;
  readonly risk: string | null;
}): { ok: true } | { ok: false; message: string } {
  if (input.status === "READY") return { ok: true };
  if (input.status === "AWAITING_APPROVAL") {
    return input.approved
      ? { ok: true }
      : { ok: false, message: "Esta demanda precisa da sua aprovação antes de executar. Veja em Aprovações." };
  }
  if (input.status === "PLANNED") {
    if (input.risk === "CRITICAL" || input.risk === "HIGH") {
      return { ok: false, message: "Risco alto: esta demanda precisa de aprovação antes de executar." };
    }
    if (input.autonomy === "CONTROLLED" || input.autonomy === "AUTONOMOUS") return { ok: true };
    if (input.autonomy === "READ_PLAN") {
      return { ok: false, message: "No modo Planejar o escritório só planeja. Escolha Controlado ou Autônomo para executar." };
    }
    return { ok: false, message: "Esse nível de autonomia pede aprovação antes de executar." };
  }
  return { ok: false, message: `Demanda não está pronta para execução (status: ${input.status}).` };
}

/** PLANNED com risco alto: precisa abrir pedido de aprovacao. */
export function needsApprovalRequest(status: string, risk: string | null): boolean {
  return status === "PLANNED" && (risk === "HIGH" || risk === "CRITICAL");
}

export async function executeDemand(
  deps: AutomationOfficeDeps,
  input: {
    readonly demandId: string;
    readonly autonomy: AutonomyLevel;
  },
) {
  const demand = await prisma.officeDemand.findUnique({
    where: { id: input.demandId },
    include: {
      approvals: {
        where: { status: "APPROVED" },
        take: 1,
      },
    },
  });

  if (!demand) {
    throw new NotFoundError("Demand", input.demandId);
  }

  assertOfficialWorkspace(demand.workspaceId);

  const verdict = canExecuteDemand({
    status: demand.status,
    approved: demand.approvals.length > 0,
    autonomy: input.autonomy,
    risk: demand.risk,
  });

  if (!verdict.ok) {
    // Demanda antiga de risco alto parada em PLANNED: em vez de 409 sem
    // saida, abre o pedido na Sala de Aprovacao e avisa a usuaria.
    if (needsApprovalRequest(demand.status, demand.risk)) {
      const pending = await prisma.officeApprovalRequest.findFirst({
        where: { demandId: demand.id, status: "PENDING" },
        select: { id: true },
      });
      const approval =
        pending ??
        (await createApprovalForDemand({
          demandId: demand.id,
          workspaceId: demand.workspaceId,
          action: `Executar demanda: ${demand.objective.slice(0, 80)}`,
          risk: demand.risk as RiskLevel,
          impact: "Execução de demanda de risco alto pelo escritório.",
          reason: "Risco alto exige aprovação humana antes da execução.",
          validated: ["Plano operacional revisado", "Workspace autorizado"],
          approveEffect: "Demanda fica pronta para executar.",
          rejectEffect: "Demanda permanece pausada até nova instrução.",
          officeDecision: "Recomendamos revisar o plano antes de aprovar.",
        }));
      await prisma.officeDemand.update({
        where: { id: demand.id },
        data: { status: "AWAITING_APPROVAL" },
      });
      throw new ConflictError(
        `Risco alto: enviamos para a Sala de Aprovação (pedido ${approval.id.slice(0, 8)}). Depois de aprovar, clique em Executar.`,
      );
    }
    throw new ConflictError(verdict.message);
  }

  // Fire-and-forget via mirror async (Opção A). Não usa OMS.run/runViaQueue.
  const submission = await submitDemandToCore(
    deps.queue,
    deps.workGovernanceGate,
    {
      workspaceId: demand.workspaceId,
      objective: demand.objective,
      correlationId: demand.id,
      contextHints: {
        correlationId: demand.id,
      },
    },
  );

  if (!submission.accepted || !submission.missionId) {
    throw new ConflictError("Core não aceitou a missão para execução.");
  }

  await prisma.officeDemand.update({
    where: { id: demand.id },
    data: {
      status: "EXECUTING",
      missionId: submission.missionId,
      autonomy: input.autonomy,
    },
  });

  await createDecisionTrace({
    workspaceId: demand.workspaceId,
    missionId: submission.missionId,
    objective: demand.objective,
    context: demand.context,
    options: [
      { id: "execute", label: "Executar via Core" },
      { id: "hold", label: "Manter em espera" },
    ],
    chosenOptionId: "execute",
    rationale: "Demanda aceita e submetida ao runtime Core existente.",
    risk: demand.risk,
    confidence: "HIGH",
    autonomy: input.autonomy,
    impact: "Missão enfileirada no MissionQueue.",
    nextAction: "Acompanhar execução",
    responsibleEmployeeId: "opera",
  });

  return {
    source: "api" as const,
    backendDependency: false as const,
    accepted: true,
    message: "Demanda aceita e submetida ao Core.",
    demandId: demand.id,
    missionId: submission.missionId,
    gateDecision: submission.gateDecision,
    redirectTo: `/app/missions/${submission.missionId}`,
  };
}

export async function getDemandById(id: string, workspaceId?: string) {
  const demand = await prisma.officeDemand.findFirst({
    where: {
      id,
      ...officialWorkspaceFilter(workspaceId),
    },
  });
  if (!demand) {
    throw new NotFoundError("Demand", id);
  }
  const reconciled = await reconcileDemandFromMission(demand);
  return reconciled.demand;
}

export function toDemandBrief(demand: {
  readonly id: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly context: string;
  readonly expectedOutcome: string;
  readonly constraintsJson: unknown;
  readonly priority: string;
  readonly risk: string;
  readonly autonomy: string;
}) {
  const constraints = Array.isArray(demand.constraintsJson)
    ? (demand.constraintsJson as string[])
    : [];
  return {
    demandId: demand.id,
    workspaceId: demand.workspaceId,
    workspaceName: resolveWorkspaceName(demand.workspaceId),
    objective: demand.objective,
    context: demand.context,
    expectedOutcome: demand.expectedOutcome,
    constraints,
    priority: demand.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    risk: demand.risk as RiskLevel,
    autonomy: demand.autonomy as AutonomyLevel,
    dependencies: [] as readonly string[],
  };
}

/**
 * Depois de "Aprovar" na Sala de Aprovacao: se o pedido era de uma
 * demanda, ja manda executar. Falha aqui nao desfaz a aprovacao — a
 * demanda fica READY e pode ser executada de novo. Devolve a frase para a
 * usuaria ou null quando nao havia demanda.
 */
export async function executeApprovedDemand(
  deps: AutomationOfficeDeps,
  approvalId: string,
  log?: { warn(obj: unknown, msg?: string): void },
): Promise<string | null> {
  const approval = await prisma.officeApprovalRequest.findUnique({
    where: { id: approvalId },
    select: { demandId: true },
  });
  if (!approval?.demandId) return null;
  const demand = await prisma.officeDemand.findUnique({
    where: { id: approval.demandId },
    select: { autonomy: true },
  });
  const autonomy = (demand?.autonomy as AutonomyLevel | null) ?? "CONTROLLED";
  try {
    await executeDemand(deps, {
      demandId: approval.demandId,
      autonomy: autonomy === "READ_PLAN" || autonomy === "HUMAN_APPROVAL" ? "CONTROLLED" : autonomy,
    });
    return "A demanda já foi enviada para execução.";
  } catch (err) {
    log?.warn({ err, approvalId }, "approved demand did not start");
    return "A demanda ficou pronta, mas não começou sozinha — abra e clique em Executar.";
  }
}
