import { DefaultResponsePolicy } from "@operaia/employee-framework";
import type { MissionResult } from "./mission-orchestrator.js";

const responsePolicy = new DefaultResponsePolicy();

/** DTOs alinhados ao contrato esperado pelo web (`apps/web/src/data/dto.ts`). */
export interface EmployeeReplyPayload {
  readonly employeeId: string;
  readonly content: string;
  readonly answer: {
    readonly summary: string;
    readonly projects: readonly string[];
    readonly risks: readonly string[];
    readonly nextActions: readonly string[];
  };
}

export type WorkflowStage =
  | "THINKING"
  | "ANALYZING"
  | "DELEGATING"
  | "EXECUTING"
  | "REVIEWING"
  | "DONE";

export type WorkflowStepStatus = "done" | "current" | "pending";

export interface WorkflowStepPayload {
  readonly stage: WorkflowStage;
  readonly actorId: string;
  readonly detail: string;
  readonly status: WorkflowStepStatus;
  readonly timestamp?: string;
}

export interface WorkflowPayload {
  readonly workspaceId: string;
  readonly title: string;
  readonly steps: readonly WorkflowStepPayload[];
}

/**
 * Apresentacao HTTP: traduz MissionResult → resposta + workflow de auditoria.
 * Nao decide nada — apenas formata o que a equipe digital ja produziu.
 */
export function presentMissionResult(
  result: MissionResult,
  workspaceId: string,
  workspaceName: string,
): { reply: EmployeeReplyPayload; workflow: WorkflowPayload } {
  const report = result.final.output.report;
  const now = new Date().toISOString();

  return {
    reply: {
      employeeId: result.final.employeeId,
      content: responsePolicy.render(report),
      answer: {
        summary: report.summary,
        projects: [
          `${workspaceName}: ${result.final.output.decision.analyzed}`,
        ],
        risks: report.risks,
        nextActions: report.nextActions,
      },
    },
    workflow: buildWorkflow(result, workspaceId, workspaceName, now),
  };
}

function buildWorkflow(
  result: MissionResult,
  workspaceId: string,
  workspaceName: string,
  now: string,
): WorkflowPayload {
  const ceoId = result.initial.employeeId;
  const hadDelegation = result.outcomes.length > 0;
  const matched = result.outcomes.filter((outcome) => outcome.matched);
  const specialistId = matched[0]?.employeeId ?? ceoId;

  const steps: WorkflowStepPayload[] = [
    {
      stage: "THINKING",
      actorId: ceoId,
      detail: `Entendendo o objetivo: ${result.initial.briefing.objective}`,
      status: "done",
      timestamp: now,
    },
    {
      stage: "ANALYZING",
      actorId: ceoId,
      detail: result.initial.output.decision.analyzed,
      status: "done",
      timestamp: now,
    },
    {
      stage: "DELEGATING",
      actorId: ceoId,
      detail: hadDelegation
        ? result.initial.output.decision.delegations
            .map((item) => `Solicitou ${item.specialization}`)
            .join("; ")
        : "Nenhuma especialidade solicitada neste ciclo",
      status: "done",
      timestamp: now,
    },
    {
      stage: "EXECUTING",
      actorId: specialistId,
      detail: hadDelegation
        ? matched
            .map(
              (outcome) =>
                outcome.result?.output.report.summary ??
                `Especialista ${outcome.employeeId}`,
            )
            .join("; ") || "Delegacao sem match de especialista"
        : "Sem execucao especializada",
      status: "done",
      timestamp: now,
    },
    {
      stage: "REVIEWING",
      actorId: ceoId,
      detail: hadDelegation
        ? "Revisao e consolidacao das entregas especializadas"
        : "Resposta direta da Opera (sem delegacao)",
      status: "done",
      timestamp: now,
    },
    {
      stage: "DONE",
      actorId: ceoId,
      detail: result.final.output.report.summary,
      status: "done",
      timestamp: now,
    },
  ];

  return {
    workspaceId,
    title: `Missao — ${workspaceName}`,
    steps,
  };
}
