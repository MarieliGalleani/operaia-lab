import type { EmployeeResult } from "@operaia/employee-runtime";
import type { Prisma } from "@operaia/database";

export interface StoredEmployeeResult {
  readonly employeeId: string;
  readonly output: {
    readonly decision: EmployeeResult["output"]["decision"];
    readonly report: EmployeeResult["output"]["report"];
    readonly quality: EmployeeResult["output"]["quality"];
  };
}

export interface CoordinatePhaseResult {
  readonly phase: "coordinated";
  readonly initial: StoredEmployeeResult;
}

export interface ExecutePhaseResult {
  readonly phase: "executed";
  readonly employeeResult: StoredEmployeeResult;
  readonly executionReport?: {
    readonly employeeId: string;
    readonly summary: string;
    readonly findings: readonly string[];
    readonly risks: readonly string[];
    readonly recommendations: readonly string[];
    readonly confidence: number;
    readonly executionTime: number;
  };
  /** Evidencias de tools realmente invocadas nesta EXECUTE. */
  readonly toolExecutions?: readonly {
    readonly toolId: string;
    readonly success: boolean;
    readonly outcome: string;
    readonly at: string;
  }[];
  /** Entrega estruturada (DELIVERED somente com evidencias reais ok). */
  readonly delivery?: {
    readonly type: "technical_analysis" | "priority_recommendation";
    readonly status: "DELIVERED" | "FAILED";
    readonly missionId: string;
    readonly employeeId: string;
    readonly objective: string;
    readonly summary: string;
    readonly findings: readonly string[];
    readonly evidence: readonly {
      readonly source: string;
      readonly data: Readonly<Record<string, unknown>>;
    }[];
    readonly recommendations: readonly string[];
    readonly deliveredAt: string;
    readonly sourceMissionId?: string;
  };
}

export interface ConsolidatePhaseResult {
  readonly phase: "consolidated";
  /**
   * Decisao COORDINATE da Opera (ADR-007 Fase 2.1).
   * Preservada quando completeConsolidation sobrescreve o resultJson da raiz.
   */
  readonly initial?: StoredEmployeeResult;
  readonly usableResult: string;
  readonly final: StoredEmployeeResult;
  readonly timing?: {
    readonly ceoMs: number;
    readonly specialistMs: number;
    readonly consolidationMs: number;
    readonly totalMs: number;
  };
  /** Entrega estruturada da Opera (F5 — priority_recommendation). */
  readonly delivery?: ExecutePhaseResult["delivery"];
}

/**
 * Mescla o consolidado com o initial da fase COORDINATE (WAITING),
 * evitando perda ao sobrescrever resultJson da raiz.
 */
export function mergeConsolidatePreservingInitial(
  previousRootResultJson: unknown,
  incoming: unknown,
): ConsolidatePhaseResult {
  const base = requireConsolidatePhaseResult(incoming);
  if (base.initial) {
    return base;
  }
  const preserved = readStoredInitial(previousRootResultJson);
  if (!preserved) {
    return base;
  }
  return {
    ...base,
    initial: preserved,
  };
}

function requireConsolidatePhaseResult(
  incoming: unknown,
): ConsolidatePhaseResult {
  if (!incoming || typeof incoming !== "object") {
    throw new Error("completeConsolidation requer ConsolidatePhaseResult");
  }
  const record = incoming as Record<string, unknown>;
  if (record.phase !== "consolidated") {
    throw new Error(
      `phase esperado consolidated, recebido: ${String(record.phase)}`,
    );
  }
  if (typeof record.usableResult !== "string" || !record.final) {
    throw new Error("ConsolidatePhaseResult incompleto (usableResult/final)");
  }
  return incoming as ConsolidatePhaseResult;
}

/** Narrowing seguro de Json → CoordinatePhaseResult (ou null). */
export function readCoordinatePhaseResult(
  resultJson: unknown,
): CoordinatePhaseResult | null {
  if (!resultJson || typeof resultJson !== "object" || Array.isArray(resultJson)) {
    return null;
  }
  const record = resultJson as Record<string, unknown>;
  if (record.phase !== "coordinated") {
    return null;
  }
  if (!record.initial || typeof record.initial !== "object") {
    return null;
  }
  return resultJson as CoordinatePhaseResult;
}

function readStoredInitial(
  resultJson: unknown,
): StoredEmployeeResult | undefined {
  if (!resultJson || typeof resultJson !== "object") {
    return undefined;
  }
  const record = resultJson as Record<string, unknown>;
  if (
    (record.phase === "coordinated" || record.phase === "consolidated") &&
    record.initial &&
    typeof record.initial === "object"
  ) {
    return record.initial as StoredEmployeeResult;
  }
  return undefined;
}

export function serializeEmployeeResult(
  result: EmployeeResult,
): StoredEmployeeResult {
  return {
    employeeId: result.employeeId,
    output: {
      decision: result.output.decision,
      report: result.output.report,
      quality: result.output.quality,
    },
  };
}

export function toEmployeeResult(
  stored: StoredEmployeeResult,
  briefing: EmployeeResult["briefing"],
): EmployeeResult {
  return {
    employeeId: stored.employeeId,
    profile: briefing as unknown as EmployeeResult["profile"],
    briefing,
    output: {
      decision: stored.output.decision,
      report: stored.output.report,
      quality: stored.output.quality,
    },
  };
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
