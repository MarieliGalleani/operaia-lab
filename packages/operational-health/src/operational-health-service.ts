/**
 * OperationalHealthService — snapshot continuo de saude (A.5.3).
 */
import {
  alertsFromRuleEvaluations,
  InMemoryAlertBus,
  type AlertBus,
  type OperationalAlert,
} from "./operational-alert.js";
import {
  DEFAULT_HEALTH_RULES,
  evaluateHealthRules,
  worstSeverity,
  type HealthRulesConfig,
  type OperationalMetricsInput,
  type RuleEvaluation,
} from "./health-rules.js";
import { logOperationalEvent } from "./observability.js";

export type OperationalHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "CRITICAL"
  | "UNKNOWN";

export interface ComponentHealth {
  readonly status: OperationalHealthStatus;
  readonly detail: string;
  readonly metrics?: Readonly<Record<string, number | boolean | null>>;
}

export interface OperationalHealthSnapshot {
  readonly status: OperationalHealthStatus;
  readonly checkedAt: string;
  readonly workers: ComponentHealth;
  readonly queue: ComponentHealth;
  readonly memory: ComponentHealth;
  readonly actions: ComponentHealth;
  readonly runtime: ComponentHealth;
  readonly scheduler: ComponentHealth;
  readonly warnings: readonly string[];
  readonly evaluations: readonly RuleEvaluation[];
  readonly alerts: readonly OperationalAlert[];
}

export interface OperationalMetricsProvider {
  collect(): Promise<OperationalMetricsInput> | OperationalMetricsInput;
}

export interface OperationalHealthServiceOptions {
  readonly metrics: OperationalMetricsProvider;
  readonly rules?: HealthRulesConfig;
  readonly alertBus?: AlertBus;
  readonly workspaceId?: string;
  /** Se true, publica alertas no bus e loga (default true). */
  readonly emitAlerts?: boolean;
}

export class OperationalHealthService {
  private readonly metrics: OperationalMetricsProvider;
  private readonly rules: HealthRulesConfig;
  private readonly alertBus: AlertBus;
  private readonly workspaceId?: string;
  private readonly emitAlerts: boolean;
  private lastSnapshot: OperationalHealthSnapshot | null = null;

  constructor(options: OperationalHealthServiceOptions) {
    this.metrics = options.metrics;
    this.rules = options.rules ?? DEFAULT_HEALTH_RULES;
    this.alertBus = options.alertBus ?? new InMemoryAlertBus();
    this.workspaceId = options.workspaceId;
    this.emitAlerts = options.emitAlerts ?? true;
  }

  get alertBusRef(): AlertBus {
    return this.alertBus;
  }

  getLastSnapshot(): OperationalHealthSnapshot | null {
    return this.lastSnapshot;
  }

  async getHealth(): Promise<OperationalHealthSnapshot> {
    const metrics = await this.metrics.collect();
    const evaluations = evaluateHealthRules(metrics, this.rules);
    const alerts = alertsFromRuleEvaluations(evaluations, {
      workspaceId: this.workspaceId,
      correlationId: `health-${Date.now()}`,
    });

    if (this.emitAlerts) {
      for (const alert of alerts) {
        this.alertBus.publish(alert);
        logOperationalEvent({
          event: "operational_alert",
          severity: alert.severity === "critical" ? "error" : "warn",
          component: "operational-health",
          workspaceId: alert.workspaceId,
          correlationId: alert.correlationId,
          payload: {
            alertType: alert.type,
            message: alert.message,
            ...alert.payload,
          },
        });
      }
    }

    const memoryRatio =
      metrics.memoryQuota && metrics.memoryQuota > 0
        ? (metrics.memoryActiveNotes ?? 0) / metrics.memoryQuota
        : 0;

    const workersStatus = deriveWorkersStatus(metrics);
    const queueStatus = componentFromRules(evaluations, [
      "queue.waiting",
      "mission.depth",
      "queue.failed_spike",
    ]);
    const memoryStatus = componentFromRules(evaluations, ["memory.quota"]);
    const runtimeStatus: ComponentHealth = {
      status: metrics.runtimeOk === false ? "CRITICAL" : "HEALTHY",
      detail: metrics.runtimeOk === false ? "runtime indisponivel" : "ok",
    };
    const actionsStatus: ComponentHealth = {
      status: metrics.actionsOk === false ? "DEGRADED" : "HEALTHY",
      detail: metrics.actionsOk === false ? "actions degradadas" : "ok",
    };
    const schedulerStatus: ComponentHealth = {
      status: metrics.schedulerRunning === false ? "DEGRADED" : "HEALTHY",
      detail:
        metrics.schedulerRunning === false ? "scheduler parado" : "running",
    };

    const ruleWorst = worstSeverity(evaluations);
    let overall = mapWorstToStatus(ruleWorst);
    if (workersStatus.status === "CRITICAL" || runtimeStatus.status === "CRITICAL") {
      overall = "CRITICAL";
    } else if (
      overall === "HEALTHY" &&
      (workersStatus.status === "DEGRADED" ||
        actionsStatus.status === "DEGRADED" ||
        schedulerStatus.status === "DEGRADED")
    ) {
      overall = "DEGRADED";
    }

    const warnings = evaluations
      .filter((e) => e.severity !== "ok")
      .map((e) => e.message);

    const snapshot: OperationalHealthSnapshot = {
      status: overall,
      checkedAt: new Date().toISOString(),
      workers: workersStatus,
      queue: {
        ...queueStatus,
        metrics: {
          waiting: metrics.queueWaiting ?? 0,
          depth: metrics.queueDepth ?? 0,
          consecutiveFailed: metrics.consecutiveFailed ?? 0,
        },
      },
      memory: {
        ...memoryStatus,
        metrics: {
          activeNotes: metrics.memoryActiveNotes ?? 0,
          quota: metrics.memoryQuota ?? 0,
          ratio: memoryRatio,
        },
      },
      actions: actionsStatus,
      runtime: runtimeStatus,
      scheduler: schedulerStatus,
      warnings,
      evaluations,
      alerts,
    };

    this.lastSnapshot = snapshot;
    logOperationalEvent({
      event: "health_snapshot",
      severity:
        overall === "CRITICAL"
          ? "error"
          : overall === "DEGRADED"
            ? "warn"
            : "info",
      component: "operational-health",
      workspaceId: this.workspaceId,
      payload: {
        status: snapshot.status,
        warnings: snapshot.warnings.length,
        alerts: snapshot.alerts.length,
      },
    });

    return snapshot;
  }
}

function componentFromRules(
  evaluations: readonly RuleEvaluation[],
  rules: readonly string[],
): ComponentHealth {
  const subset = evaluations.filter((e) => rules.includes(e.rule));
  if (subset.length === 0) {
    return { status: "UNKNOWN", detail: "sem metrica" };
  }
  const worst = worstSeverity(subset);
  return {
    status: mapWorstToStatus(worst),
    detail: subset.map((e) => e.message).join("; "),
  };
}

function mapWorstToStatus(
  severity: "ok" | "warning" | "critical",
): OperationalHealthStatus {
  if (severity === "critical") {
    return "CRITICAL";
  }
  if (severity === "warning") {
    return "DEGRADED";
  }
  return "HEALTHY";
}

function deriveWorkersStatus(metrics: OperationalMetricsInput): ComponentHealth {
  const alive = metrics.workersAlive;
  const expected = metrics.workersExpected;
  if (alive === undefined || expected === undefined) {
    const hb = metrics.oldestWorkerHeartbeatAgeMs;
    if (hb === null) {
      return { status: "CRITICAL", detail: "nenhum heartbeat" };
    }
    return { status: "UNKNOWN", detail: "sem metrica de workers" };
  }
  if (alive === 0 && expected > 0) {
    return {
      status: "CRITICAL",
      detail: `0/${expected} workers vivos`,
      metrics: { alive, expected },
    };
  }
  if (alive < expected) {
    return {
      status: "DEGRADED",
      detail: `${alive}/${expected} workers vivos`,
      metrics: { alive, expected },
    };
  }
  return {
    status: "HEALTHY",
    detail: `${alive}/${expected} workers vivos`,
    metrics: { alive, expected },
  };
}
