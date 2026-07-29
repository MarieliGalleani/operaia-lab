import type {
  DomainSignalRecord,
  EvaluationAudit,
  OperaEvaluationContext,
} from "./types.js";

export function toOperaEvaluationContext(
  signal: DomainSignalRecord,
  similarSignalIds: readonly string[] = [],
): OperaEvaluationContext {
  return {
    signalId: signal.id,
    workspaceId: signal.workspaceId,
    correlationId: signal.correlationId,
    sourceType: signal.sourceType,
    type: signal.type,
    sourceId: signal.sourceId,
    deliveryId: signal.deliveryId,
    signalHash: signal.signalHash,
    status: signal.status,
    payload: signal.payloadJson,
    evaluation: toEvaluationAudit(signal),
    similarSignalIds,
    missionId: signal.missionId,
  };
}

export function toEvaluationAudit(
  signal: DomainSignalRecord,
): EvaluationAudit | null {
  if (
    !signal.evaluationDecision ||
    !signal.evaluationPolicy ||
    !signal.evaluationReason
  ) {
    return null;
  }
  const fromJson = signal.evaluationJson ?? {};
  return {
    decision: signal.evaluationDecision,
    policy: signal.evaluationPolicy,
    reason: signal.evaluationReason,
    appliedAt:
      typeof fromJson.appliedAt === "string"
        ? fromJson.appliedAt
        : (signal.evaluatedAt?.toISOString() ?? new Date().toISOString()),
    inputs:
      fromJson.inputs && typeof fromJson.inputs === "object"
        ? (fromJson.inputs as Record<string, unknown>)
        : undefined,
    similarSignalIds: Array.isArray(fromJson.similarSignalIds)
      ? (fromJson.similarSignalIds as string[])
      : undefined,
  };
}

export function buildEvaluationJson(audit: EvaluationAudit): Record<string, unknown> {
  return {
    decision: audit.decision,
    policy: audit.policy,
    reason: audit.reason,
    appliedAt: audit.appliedAt,
    ...(audit.inputs ? { inputs: audit.inputs } : {}),
    ...(audit.similarSignalIds
      ? { similarSignalIds: [...audit.similarSignalIds] }
      : {}),
  };
}
