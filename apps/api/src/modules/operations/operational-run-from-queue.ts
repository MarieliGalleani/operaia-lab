import type { MissionResult } from "../employees/mission-orchestrator.js";
import { presentMissionResult } from "../employees/mission-presenter.js";
import type { EmployeeReplyPayload } from "../employees/mission-presenter.js";
import { CEO_EMPLOYEE_ID } from "../runtime/mission-states.js";
import {
  toEmployeeResult,
  type StoredEmployeeResult,
} from "../runtime/mission-result-store.js";
import { identifyOperationalGaps } from "./identify-operational-gaps.js";
import type { OperationalGap, OperationalRun } from "./operational-run.js";
import {
  buildOutcomesFromExecuteChildren,
  ownerForcedGap,
  QUEUE_EXECUTION_STUB_ID,
  readConsolidateResult,
  responsePolicy,
  stubBriefing,
  stubExecutionPlan,
  stubExecutionResult,
  toIso,
  type QueueMissionNode,
} from "./mission-tree-projection-helpers.js";

export { QUEUE_EXECUTION_STUB_ID };
export type { QueueMissionNode };

/**
 * Snapshot minimo de Mission (fila) para projecao Assisted parcial (Fase 2.0).
 */
export interface QueueMissionSnapshot {
  readonly id: string;
  readonly status: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly resultJson: unknown;
  readonly startedAt: Date | string | null;
  readonly finishedAt: Date | string | null;
}

export interface ProjectMissionToOperationalRunInput {
  readonly mission: QueueMissionSnapshot;
  readonly workspaceName: string;
  readonly requestedEmployeeId?: string;
}

/** Projecao parcial Mission → Assisted (ADR-007 Fase 2.0). */
export interface OperationalRunFromQueue {
  readonly id: string;
  readonly status: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly objective: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly resultJson: unknown;
  readonly usableResult: string | null;
  readonly reply: EmployeeReplyPayload | null;
  readonly gaps: readonly OperationalGap[];
}

export interface MissionTreeProjectionInput {
  readonly root: QueueMissionNode;
  readonly children: readonly QueueMissionNode[];
  readonly workspaceName: string;
  readonly requestedEmployeeId?: string;
}

export type MissionTreeProjectionErrorCode =
  | "NOT_COMPLETED"
  | "INVALID_RESULT"
  | "INCOMPLETE_MISSION";

export class MissionTreeProjectionError extends Error {
  constructor(
    message: string,
    readonly code: MissionTreeProjectionErrorCode,
    readonly missionId?: string,
  ) {
    super(message);
    this.name = "MissionTreeProjectionError";
  }
}

/**
 * Projeta campos disponiveis da fila para o contrato Assisted parcial (Fase 2.0).
 */
export function projectMissionToOperationalRun(
  input: ProjectMissionToOperationalRunInput,
): OperationalRunFromQueue {
  const { mission, workspaceName, requestedEmployeeId } = input;
  const gaps: OperationalGap[] = [];

  if (
    requestedEmployeeId !== undefined &&
    requestedEmployeeId !== CEO_EMPLOYEE_ID
  ) {
    gaps.push(ownerForcedGap(requestedEmployeeId));
  }

  const consolidated = readConsolidateResult(mission.resultJson);
  const usableResult = consolidated?.usableResult ?? null;
  const reply = consolidated
    ? buildReplyFromStored(consolidated.final, workspaceName)
    : null;

  if (mission.resultJson != null && !consolidated && usableResult === null) {
    gaps.push({
      code: "assisted-projection-partial",
      severity: "info",
      message:
        "resultJson presente mas ainda sem fase consolidated; reply/usableResult pendentes.",
    });
  }

  return {
    id: mission.id,
    status: mission.status,
    workspaceId: mission.workspaceId,
    workspaceName,
    objective: mission.objective,
    startedAt: toIso(mission.startedAt) ?? new Date(0).toISOString(),
    finishedAt: toIso(mission.finishedAt),
    resultJson: mission.resultJson,
    usableResult,
    reply,
    gaps,
  };
}

/**
 * Projector puro Mission tree → OperationalRun (ADR-007 Fase 2.1b).
 * Nao consulta Prisma, workers nem HTTP.
 */
export function projectMissionTreeToOperationalRun(
  input: MissionTreeProjectionInput,
): OperationalRun {
  const { root, children, workspaceName, requestedEmployeeId } = input;

  if (root.status !== "COMPLETED") {
    throw new MissionTreeProjectionError(
      `Raiz ${root.id} nao esta COMPLETED (status=${root.status})`,
      "NOT_COMPLETED",
      root.id,
    );
  }

  const consolidated = readConsolidateResult(root.resultJson);
  if (!consolidated) {
    throw new MissionTreeProjectionError(
      `Raiz ${root.id} sem ConsolidatePhaseResult em resultJson`,
      "INVALID_RESULT",
      root.id,
    );
  }

  const storedInitial = consolidated.initial ?? null;
  if (!storedInitial) {
    throw new MissionTreeProjectionError(
      `Raiz ${root.id} consolidada sem initial (decisao COORDINATE ausente)`,
      "INCOMPLETE_MISSION",
      root.id,
    );
  }

  const finishedAt = toIso(root.finishedAt);
  if (!finishedAt) {
    throw new MissionTreeProjectionError(
      `Raiz ${root.id} COMPLETED sem finishedAt`,
      "INCOMPLETE_MISSION",
      root.id,
    );
  }

  const startedAt =
    toIso(root.startedAt) ?? toIso(root.finishedAt) ?? finishedAt;

  const briefing = stubBriefing(root.objective);
  const initial = toEmployeeResult(storedInitial, briefing);
  const final = toEmployeeResult(consolidated.final, briefing);
  const outcomes = buildOutcomesFromExecuteChildren(children);

  const executionPlan = stubExecutionPlan(root.workspaceId);
  const executionResult = stubExecutionResult();
  const timing = {
    ceoMs: consolidated.timing?.ceoMs ?? 0,
    specialistMs: consolidated.timing?.specialistMs ?? 0,
    consolidationMs: consolidated.timing?.consolidationMs ?? 0,
    totalMs:
      consolidated.timing?.totalMs ??
      Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
  };

  const missionResult: MissionResult = {
    employeeId: final.employeeId,
    initial,
    outcomes,
    final,
    executionPlan,
    executionResult,
    executionSummaries: [],
    timing,
  };

  const presented = presentMissionResult(
    missionResult,
    root.workspaceId,
    workspaceName,
  );

  const llmEvents: OperationalRun["llmEvents"] = [];
  const gaps: OperationalGap[] = [
    ...identifyOperationalGaps(missionResult, llmEvents),
    {
      code: "assisted-llm-events-unavailable",
      severity: "info",
      message:
        "llmEvents nao persistidos na MissionQueue; projector usa lista vazia.",
    },
    {
      code: "assisted-execution-untracked",
      severity: "info",
      message:
        "Execution Engine nao persistido no resultJson da fila; audit usa stub queue-untracked.",
    },
  ];

  if (
    requestedEmployeeId !== undefined &&
    requestedEmployeeId !== CEO_EMPLOYEE_ID
  ) {
    gaps.push(ownerForcedGap(requestedEmployeeId));
  }

  return {
    id: root.id,
    status: "completed",
    workspaceId: root.workspaceId,
    workspaceName,
    objective: root.objective,
    startedAt,
    finishedAt,
    mission: missionResult,
    reply: presented.reply,
    workflow: presented.workflow,
    llmEvents,
    gaps,
    usableResult: consolidated.usableResult,
    execution: {
      planId: QUEUE_EXECUTION_STUB_ID,
      status: "untracked",
      executionId: QUEUE_EXECUTION_STUB_ID,
      durationMs: 0,
      results: [],
    },
    timing,
  };
}

/**
 * Projecao intermediaria quando waitUntilTerminal estoura (Fase 1 Gateway).
 * `id` = Mission.id da Queue — cliente pode consultar GET /api/v1/missions.
 */
export function projectPendingMissionTreeToOperationalRun(input: {
  readonly root: QueueMissionNode;
  readonly children?: readonly QueueMissionNode[];
  readonly workspaceName: string;
  readonly requestedEmployeeId?: string;
  readonly runStatus: "in_progress" | "timed_out";
  readonly waitTimeoutMs?: number;
}): OperationalRun {
  const {
    root,
    workspaceName,
    requestedEmployeeId,
    runStatus,
    waitTimeoutMs,
  } = input;
  const startedAt =
    toIso(root.startedAt) ?? new Date().toISOString();
  const briefing = stubBriefing(root.objective);
  const placeholder = pendingEmployeeResult(briefing);
  const missionResult: MissionResult = {
    employeeId: CEO_EMPLOYEE_ID,
    initial: placeholder,
    outcomes: buildOutcomesFromExecuteChildren(input.children ?? []),
    final: placeholder,
    executionPlan: stubExecutionPlan(root.workspaceId),
    executionResult: stubExecutionResult(),
    executionSummaries: [],
    timing: { ceoMs: 0, specialistMs: 0, consolidationMs: 0, totalMs: 0 },
  };

  const statusLine =
    runStatus === "timed_out"
      ? `Timeout aguardando conclusao na Mission Queue (status=${root.status}${waitTimeoutMs ? `, limite=${waitTimeoutMs}ms` : ""}).`
      : `Missao ainda em andamento na Mission Queue (status=${root.status}).`;

  const usableResult = [
    statusLine,
    `missionId=${root.id}`,
    "Consulte GET /api/v1/missions para o estado atualizado.",
  ].join(" ");

  const gaps: OperationalGap[] = [
    {
      code:
        runStatus === "timed_out"
          ? "assisted-wait-timeout"
          : "assisted-in-progress",
      severity: "warning",
      message: usableResult,
    },
  ];

  if (
    requestedEmployeeId !== undefined &&
    requestedEmployeeId !== CEO_EMPLOYEE_ID
  ) {
    gaps.push(ownerForcedGap(requestedEmployeeId));
  }

  return {
    id: root.id,
    status: runStatus,
    workspaceId: root.workspaceId,
    workspaceName,
    objective: root.objective,
    startedAt,
    finishedAt: null,
    mission: missionResult,
    reply: {
      employeeId: CEO_EMPLOYEE_ID,
      content: usableResult,
      answer: {
        summary: statusLine,
        projects: [`${workspaceName}: missao ${root.id}`],
        risks: ["Resultado ainda nao consolidado."],
        nextActions: [
          `Consultar missao ${root.id} em GET /api/v1/missions`,
        ],
      },
    },
    workflow: {
      workspaceId: root.workspaceId,
      title: `Missao ${root.status}`,
      steps: [
        {
          stage: "ANALYZING",
          actorId: CEO_EMPLOYEE_ID,
          detail: `Mission Queue status=${root.status}`,
          status: "current",
        },
      ],
    },
    llmEvents: [],
    gaps,
    usableResult,
    execution: {
      planId: QUEUE_EXECUTION_STUB_ID,
      status: "untracked",
      executionId: QUEUE_EXECUTION_STUB_ID,
      durationMs: 0,
      results: [],
    },
    timing: missionResult.timing,
    queueStatus: root.status,
  };
}

function pendingEmployeeResult(
  briefing: ReturnType<typeof stubBriefing>,
): ReturnType<typeof toEmployeeResult> {
  return toEmployeeResult(
    {
      employeeId: CEO_EMPLOYEE_ID,
      output: {
        decision: {
          analyzed: "Aguardando conclusao na Mission Queue.",
          decision: "pending",
          reasoning: "Projecao intermediaria Assisted→Queue (Fase 1 Gateway).",
          recommendations: [],
          delegations: [],
          risks: ["Resultado ainda nao consolidado."],
          nextActions: ["Aguardar workers / consultar GET /api/v1/missions"],
        },
        report: {
          summary: "Missao em andamento.",
          analysis: "Projecao intermediaria Assisted→Queue.",
          plan: [],
          recommendations: [],
          risks: ["Resultado ainda nao consolidado."],
          nextActions: ["Consultar GET /api/v1/missions"],
        },
        quality: {
          passed: false,
          issues: [
            {
              rule: "pending-queue",
              message: "Missao ainda nao consolidada na fila.",
            },
          ],
        },
      },
    },
    briefing,
  );
}

function buildReplyFromStored(
  final: StoredEmployeeResult,
  workspaceName: string,
): EmployeeReplyPayload {
  const report = final.output.report;
  const decision = final.output.decision;
  return {
    employeeId: final.employeeId,
    content: responsePolicy.render(report),
    answer: {
      summary: report.summary,
      projects: [`${workspaceName}: ${decision.analyzed}`],
      risks: [...report.risks],
      nextActions: [...report.nextActions],
    },
  };
}
