/**
 * Alertas operacionais internos — Supervisor registra, nao cria loops.
 */
import type { RuleEvaluation } from "./health-rules.js";

export const OperationalAlertType = {
  MEMORY_QUOTA_WARNING: "MEMORY_QUOTA_WARNING",
  MEMORY_QUOTA_CRITICAL: "MEMORY_QUOTA_CRITICAL",
  QUEUE_CONGESTION: "QUEUE_CONGESTION",
  MISSION_DEPTH_HIGH: "MISSION_DEPTH_HIGH",
  WORKER_OFFLINE: "WORKER_OFFLINE",
  FAILED_SPIKE: "FAILED_SPIKE",
} as const;

export type OperationalAlertType =
  (typeof OperationalAlertType)[keyof typeof OperationalAlertType];

export type AlertSeverity = "warning" | "critical";

export interface OperationalAlert {
  readonly type: OperationalAlertType;
  readonly severity: AlertSeverity;
  readonly message: string;
  readonly workspaceId?: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface AlertBus {
  publish(alert: OperationalAlert): void;
  list(): readonly OperationalAlert[];
  clear(): void;
}

export class InMemoryAlertBus implements AlertBus {
  private readonly alerts: OperationalAlert[] = [];

  publish(alert: OperationalAlert): void {
    this.alerts.push(alert);
  }

  list(): readonly OperationalAlert[] {
    return [...this.alerts];
  }

  clear(): void {
    this.alerts.length = 0;
  }
}

const RULE_TO_ALERT: Readonly<
  Record<string, { warning: OperationalAlertType; critical: OperationalAlertType }>
> = {
  "memory.quota": {
    warning: OperationalAlertType.MEMORY_QUOTA_WARNING,
    critical: OperationalAlertType.MEMORY_QUOTA_CRITICAL,
  },
  "queue.waiting": {
    warning: OperationalAlertType.QUEUE_CONGESTION,
    critical: OperationalAlertType.QUEUE_CONGESTION,
  },
  "mission.depth": {
    warning: OperationalAlertType.MISSION_DEPTH_HIGH,
    critical: OperationalAlertType.MISSION_DEPTH_HIGH,
  },
  "queue.failed_spike": {
    warning: OperationalAlertType.FAILED_SPIKE,
    critical: OperationalAlertType.FAILED_SPIKE,
  },
  "worker.heartbeat": {
    warning: OperationalAlertType.WORKER_OFFLINE,
    critical: OperationalAlertType.WORKER_OFFLINE,
  },
};

export function alertsFromRuleEvaluations(
  evaluations: readonly RuleEvaluation[],
  context: {
    readonly workspaceId?: string;
    readonly correlationId?: string;
    readonly now?: () => Date;
  } = {},
): readonly OperationalAlert[] {
  const now = context.now ?? (() => new Date());
  const out: OperationalAlert[] = [];

  for (const evaluation of evaluations) {
    if (evaluation.severity === "ok") {
      continue;
    }
    const mapping = RULE_TO_ALERT[evaluation.rule];
    if (!mapping) {
      continue;
    }
    const type =
      evaluation.severity === "critical" ? mapping.critical : mapping.warning;
    out.push({
      type,
      severity: evaluation.severity,
      message: evaluation.message,
      workspaceId: context.workspaceId,
      correlationId: context.correlationId,
      timestamp: now().toISOString(),
      payload: {
        rule: evaluation.rule,
        value: evaluation.value,
        warning: evaluation.warning,
        critical: evaluation.critical,
      },
    });
  }

  return out;
}
