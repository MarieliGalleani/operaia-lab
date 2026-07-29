import type {
  DelegationOutcome,
  EmployeeContext,
  EmployeeResult,
  ExecutionSummaryNote,
} from "@operaia/employee-runtime";
import type {
  ExecutionPlan,
  ExecutionResult,
  NormalizedActionResult,
} from "@operaia/execution-engine";
import type { DigitalOffice } from "./office-composition.js";
import { buildDomainSyncActions } from "../operations/mission-domain-sync.js";
import {
  buildMissionExecutionPlan,
  executeMissionPlan,
  type MissionExecutionStack,
} from "../operations/mission-execution.js";

/** Metricas de tempo por fase da missao (ms). */
export interface MissionTiming {
  readonly ceoMs: number;
  readonly specialistMs: number;
  readonly consolidationMs: number;
  readonly totalMs: number;
}

/**
 * Resultado de uma missao orquestrada: ciclo intelectual + execucao + timing.
 */
export interface MissionResult {
  readonly employeeId: string;
  readonly initial: EmployeeResult;
  readonly outcomes: readonly DelegationOutcome[];
  readonly final: EmployeeResult;
  readonly executionPlan: ExecutionPlan;
  readonly executionResult: ExecutionResult;
  readonly executionSummaries: readonly NormalizedActionResult[];
  readonly timing: MissionTiming;
}

/**
 * Orquestra o fluxo de missao na API — SEM regras de negocio de funcionarios.
 *
 *   Opera (decide) → Delegation → Execution Plan → Engine/Policy/Registry
 *   → Execution Result → Opera (consolida) → resposta
 *
 * O Execution Engine fica ABAIXO deste orquestrador (nao o substitui).
 */
export class MissionOrchestrator {
  constructor(
    private readonly office: DigitalOffice,
    private readonly execution: MissionExecutionStack,
  ) {}

  async run(
    employeeId: string,
    context: EmployeeContext,
  ): Promise<MissionResult> {
    const wallStart = nowMs();
    const { registry, runner, delegation, llm } = this.office;
    const employee = registry.require(employeeId).create({ llm });

    const ceoStart = nowMs();
    const initial = await runner.run(employee, context);
    const ceoMs = nowMs() - ceoStart;
    const requests = initial.output.decision.delegations;

    const specialistStart = nowMs();
    const outcomes =
      requests.length > 0
        ? await delegation.run(requests, context)
        : [];
    const specialistMs = nowMs() - specialistStart;

    const extraActions = buildDomainSyncActions({
      outcomes,
      workspaceTasks: context.workspace.tasks ?? [],
    });
    console.log("[mission-orchestrator] domain-sync actions", {
      objective: context.objective,
      outcomeCount: outcomes.length,
      extraActionTypes: extraActions.map((action) => action.type),
    });

    const executionPlan = buildMissionExecutionPlan({
      workspaceId: context.workspace.workspaceId,
      objective: context.objective,
      extraActions,
    });
    const { result: executionResult, summaries: executionSummaries } =
      await executeMissionPlan(this.execution, executionPlan);

    const summaryNotes: readonly ExecutionSummaryNote[] = executionSummaries.map(
      (item) => ({
        actionId: item.actionId,
        actionType: item.actionType,
        status: item.status,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        duration: item.duration,
        ...(item.output !== undefined ? { output: item.output } : {}),
        ...(item.error !== undefined ? { error: item.error } : {}),
      }),
    );

    if (outcomes.length === 0) {
      return {
        employeeId,
        initial,
        outcomes,
        final: initial,
        executionPlan,
        executionResult,
        executionSummaries,
        timing: {
          ceoMs,
          specialistMs: 0,
          consolidationMs: 0,
          totalMs: nowMs() - wallStart,
        },
      };
    }

    const consolidationStart = nowMs();
    const final = await runner.run(employee, {
      ...context,
      delegationOutcomes: outcomes,
      executionSummaries: summaryNotes,
    });
    const consolidationMs = nowMs() - consolidationStart;

    return {
      employeeId,
      initial,
      outcomes,
      final,
      executionPlan,
      executionResult,
      executionSummaries,
      timing: {
        ceoMs,
        specialistMs,
        consolidationMs,
        totalMs: nowMs() - wallStart,
      },
    };
  }
}

function nowMs(): number {
  return Date.now();
}
