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
}

export interface ConsolidatePhaseResult {
  readonly phase: "consolidated";
  readonly usableResult: string;
  readonly final: StoredEmployeeResult;
  readonly timing?: {
    readonly ceoMs: number;
    readonly specialistMs: number;
    readonly consolidationMs: number;
    readonly totalMs: number;
  };
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
