import {
  BriefingBuilder,
  DefaultResponsePolicy,
  type EmployeeBriefing,
  type Specialization,
} from "@operaia/employee-framework";
import type { DelegationOutcome } from "@operaia/employee-runtime";
import {
  ExecutionStatus,
  type ExecutionPlan,
  type ExecutionResult,
} from "@operaia/execution-engine";
import { CEO_EMPLOYEE_ID, MissionKind } from "../runtime/mission-states.js";
import {
  toEmployeeResult,
  type ConsolidatePhaseResult,
  type ExecutePhaseResult,
} from "../runtime/mission-result-store.js";
import type { OperationalGap } from "./operational-run.js";

/** Stub explicito: Path B ainda nao persiste Execution Engine no resultJson. */
export const QUEUE_EXECUTION_STUB_ID = "queue-untracked";

/** No da arvore da fila (projector Fase 2.1b). */
export interface QueueMissionNode {
  readonly id: string;
  readonly status: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly missionKind: string;
  readonly ownerEmployeeId: string;
  readonly requiredSpecialization: string | null;
  readonly parentMissionId: string | null;
  readonly resultJson: unknown;
  readonly startedAt: Date | string | null;
  readonly finishedAt: Date | string | null;
}

export function readConsolidateResult(
  resultJson: unknown,
): ConsolidatePhaseResult | null {
  if (!resultJson || typeof resultJson !== "object") {
    return null;
  }
  const record = resultJson as Record<string, unknown>;
  if (record.phase !== "consolidated") {
    return null;
  }
  if (typeof record.usableResult !== "string" || !record.final) {
    return null;
  }
  return resultJson as ConsolidatePhaseResult;
}

export function buildOutcomesFromExecuteChildren(
  children: readonly QueueMissionNode[],
): DelegationOutcome[] {
  return children
    .filter((child) => child.missionKind === MissionKind.EXECUTE)
    .map((child) => {
      const specialization = (child.requiredSpecialization ??
        "UNKNOWN") as Specialization;
      const request = {
        specialization,
        reason: child.objective,
        task: child.objective,
      };

      const stored = readExecuteResult(child.resultJson);
      const unmatchedOwner =
        !child.ownerEmployeeId || child.ownerEmployeeId === "unmatched";

      if (
        child.status !== "COMPLETED" ||
        !stored?.employeeResult ||
        unmatchedOwner
      ) {
        return { request, matched: false };
      }

      return {
        request,
        matched: true,
        employeeId: child.ownerEmployeeId,
        result: toEmployeeResult(
          stored.employeeResult,
          stubBriefing(child.objective),
        ),
      };
    });
}

/** Briefing minimo completo via builder (contrato EmployeeBriefing). */
export function stubBriefing(objective: string): EmployeeBriefing {
  return new BriefingBuilder().build(
    { workspaceId: "stub", name: "", objective },
    objective,
  );
}

export function stubExecutionPlan(workspaceId: string): ExecutionPlan {
  return {
    id: QUEUE_EXECUTION_STUB_ID,
    actions: [],
    metadata: {
      source: "mission-queue-projection-stub",
      workspaceId,
    },
  };
}

export function stubExecutionResult(): ExecutionResult {
  return {
    executionId: QUEUE_EXECUTION_STUB_ID,
    status: ExecutionStatus.SUCCESS,
    executed: [],
    failed: [],
    results: [],
    durationMs: 0,
    logs: [],
  };
}

export function ownerForcedGap(requestedEmployeeId: string): OperationalGap {
  return {
    code: "assisted-owner-forced-opera",
    severity: "info",
    message: `employeeId solicitado (${requestedEmployeeId}) nao e Mission oficial; COORDINATE usa owner ${CEO_EMPLOYEE_ID}.`,
  };
}

export function toIso(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.toISOString();
}

export const responsePolicy = new DefaultResponsePolicy();

function readExecuteResult(resultJson: unknown): ExecutePhaseResult | null {
  if (!resultJson || typeof resultJson !== "object") {
    return null;
  }
  const record = resultJson as Record<string, unknown>;
  if (record.phase !== "executed" || !record.employeeResult) {
    return null;
  }
  return resultJson as ExecutePhaseResult;
}
