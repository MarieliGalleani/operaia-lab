import {
  ExecutionStatus,
  type ExecutionEngine,
  type ExecutionPlan,
  type ExecutionResult,
} from "@operaia/execution-engine";
import {
  ExecutionOutcomeStatus,
  type ExecutionEnginePort,
  type ExecutionSummary,
  type ProposedPlan,
} from "@operaia/orchestration-engine";
import { InvalidWorkspacePlanError } from "../errors/workspace-errors.js";

/**
 * Adapta o Execution Engine concreto a porta neutra ExecutionEnginePort.
 * Reinterpreta o payload opaco como ExecutionPlan (produzido pelo
 * RuntimeAdapter) e converte ExecutionResult -> ExecutionSummary neutro.
 */
export class ExecutionAdapter implements ExecutionEnginePort {
  constructor(private readonly engine: ExecutionEngine) {}

  async execute(plan: ProposedPlan): Promise<ExecutionSummary> {
    const executionPlan = asExecutionPlan(plan.payload);
    const result = await this.engine.execute(executionPlan);
    return summarize(result);
  }
}

function asExecutionPlan(payload: unknown): ExecutionPlan {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { actions?: unknown }).actions)
  ) {
    throw new InvalidWorkspacePlanError(
      "Payload do plano nao e um ExecutionPlan valido.",
    );
  }
  return payload as ExecutionPlan;
}

function summarize(result: ExecutionResult): ExecutionSummary {
  return {
    status: mapStatus(result.status),
    executed: result.executed.length,
    failed: result.failed.length,
    durationMs: result.durationMs,
  };
}

function mapStatus(status: ExecutionStatus): ExecutionOutcomeStatus {
  switch (status) {
    case ExecutionStatus.SUCCESS:
      return ExecutionOutcomeStatus.SUCCESS;
    case ExecutionStatus.PARTIAL:
      return ExecutionOutcomeStatus.PARTIAL;
    case ExecutionStatus.FAILED:
      return ExecutionOutcomeStatus.FAILED;
    default:
      return ExecutionOutcomeStatus.FAILED;
  }
}
