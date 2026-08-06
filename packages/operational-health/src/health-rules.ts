/**
 * Regras configuraveis de saude operacional (A.5.3).
 */

export interface ThresholdPair {
  /** Fração 0–1 ou contagem absoluta, conforme a regra. */
  readonly warning: number;
  readonly critical: number;
}

export interface HealthRulesConfig {
  readonly memoryQuotaRatio: ThresholdPair;
  readonly queueWaiting: ThresholdPair;
  readonly consecutiveFailed: ThresholdPair;
  readonly missionDepth: ThresholdPair;
  readonly workerHeartbeatMs: ThresholdPair;
}

export const DEFAULT_HEALTH_RULES: HealthRulesConfig = {
  memoryQuotaRatio: { warning: 0.8, critical: 0.95 },
  queueWaiting: { warning: 20, critical: 50 },
  consecutiveFailed: { warning: 5, critical: 20 },
  missionDepth: { warning: 5, critical: 10 },
  workerHeartbeatMs: { warning: 30_000, critical: 60_000 },
};

export type RuleSeverity = "ok" | "warning" | "critical";

export interface RuleEvaluation {
  readonly rule: string;
  readonly severity: RuleSeverity;
  readonly value: number;
  readonly warning: number;
  readonly critical: number;
  readonly message: string;
}

export interface OperationalMetricsInput {
  readonly memoryActiveNotes?: number;
  readonly memoryQuota?: number;
  readonly queueWaiting?: number;
  readonly queueDepth?: number;
  readonly consecutiveFailed?: number;
  readonly oldestWorkerHeartbeatAgeMs?: number | null;
  readonly workersAlive?: number;
  readonly workersExpected?: number;
  readonly actionsOk?: boolean;
  readonly runtimeOk?: boolean;
  readonly schedulerRunning?: boolean;
}

export function evaluateThreshold(
  value: number,
  pair: ThresholdPair,
  ascending = true,
): RuleSeverity {
  if (ascending) {
    if (value >= pair.critical) {
      return "critical";
    }
    if (value >= pair.warning) {
      return "warning";
    }
    return "ok";
  }
  // Para heartbeat age: maior = pior (ascending)
  if (value >= pair.critical) {
    return "critical";
  }
  if (value >= pair.warning) {
    return "warning";
  }
  return "ok";
}

export function evaluateHealthRules(
  metrics: OperationalMetricsInput,
  rules: HealthRulesConfig = DEFAULT_HEALTH_RULES,
): readonly RuleEvaluation[] {
  const results: RuleEvaluation[] = [];

  if (
    metrics.memoryActiveNotes !== undefined &&
    metrics.memoryQuota !== undefined &&
    metrics.memoryQuota > 0
  ) {
    const ratio = metrics.memoryActiveNotes / metrics.memoryQuota;
    const severity = evaluateThreshold(ratio, rules.memoryQuotaRatio);
    results.push({
      rule: "memory.quota",
      severity,
      value: ratio,
      warning: rules.memoryQuotaRatio.warning,
      critical: rules.memoryQuotaRatio.critical,
      message: `Memoria em ${(ratio * 100).toFixed(1)}% da quota (${metrics.memoryActiveNotes}/${metrics.memoryQuota})`,
    });
  }

  if (metrics.queueWaiting !== undefined) {
    const severity = evaluateThreshold(
      metrics.queueWaiting,
      rules.queueWaiting,
    );
    results.push({
      rule: "queue.waiting",
      severity,
      value: metrics.queueWaiting,
      warning: rules.queueWaiting.warning,
      critical: rules.queueWaiting.critical,
      message: `WAITING=${metrics.queueWaiting}`,
    });
  }

  if (metrics.queueDepth !== undefined) {
    const severity = evaluateThreshold(
      metrics.queueDepth,
      rules.missionDepth,
    );
    results.push({
      rule: "mission.depth",
      severity,
      value: metrics.queueDepth,
      warning: rules.missionDepth.warning,
      critical: rules.missionDepth.critical,
      message: `depth=${metrics.queueDepth}`,
    });
  }

  if (metrics.consecutiveFailed !== undefined) {
    const severity = evaluateThreshold(
      metrics.consecutiveFailed,
      rules.consecutiveFailed,
    );
    results.push({
      rule: "queue.failed_spike",
      severity,
      value: metrics.consecutiveFailed,
      warning: rules.consecutiveFailed.warning,
      critical: rules.consecutiveFailed.critical,
      message: `FAILED consecutivos/recentes=${metrics.consecutiveFailed}`,
    });
  }

  if (
    metrics.oldestWorkerHeartbeatAgeMs !== undefined &&
    metrics.oldestWorkerHeartbeatAgeMs !== null
  ) {
    const age = metrics.oldestWorkerHeartbeatAgeMs;
    const severity = evaluateThreshold(age, rules.workerHeartbeatMs);
    results.push({
      rule: "worker.heartbeat",
      severity,
      value: age,
      warning: rules.workerHeartbeatMs.warning,
      critical: rules.workerHeartbeatMs.critical,
      message: `heartbeat mais antigo=${age}ms`,
    });
  }

  return results;
}

export function worstSeverity(
  evaluations: readonly RuleEvaluation[],
): RuleSeverity {
  if (evaluations.some((e) => e.severity === "critical")) {
    return "critical";
  }
  if (evaluations.some((e) => e.severity === "warning")) {
    return "warning";
  }
  return "ok";
}
