/**
 * @operaia/operational-health — hardening operacional permanente (A.5.3).
 */

export {
  OperationCriticality,
  CriticalOperation,
  NonCriticalOperation,
  classifyOperation,
  type KnownOperation,
} from "./operation-criticality.js";

export {
  FailurePolicy,
  defaultFailurePolicy,
  type FailurePolicyContext,
  type FailurePolicyDecision,
  type NonCriticalRunInput,
} from "./failure-policy.js";

export {
  DEFAULT_HEALTH_RULES,
  evaluateHealthRules,
  evaluateThreshold,
  worstSeverity,
  type HealthRulesConfig,
  type OperationalMetricsInput,
  type RuleEvaluation,
  type RuleSeverity,
  type ThresholdPair,
} from "./health-rules.js";

export {
  OperationalAlertType,
  InMemoryAlertBus,
  alertsFromRuleEvaluations,
  type AlertBus,
  type AlertSeverity,
  type OperationalAlert,
} from "./operational-alert.js";

export {
  OperationalHealthService,
  type ComponentHealth,
  type OperationalHealthServiceOptions,
  type OperationalHealthSnapshot,
  type OperationalHealthStatus,
  type OperationalMetricsProvider,
} from "./operational-health-service.js";

export {
  OperationalMaintenance,
  type LedgerMaintenancePort,
  type MaintenanceReport,
  type MaintenanceResult,
  type MemoryMaintenancePort,
  type OperationalMaintenanceOptions,
  type QueueMaintenancePort,
} from "./maintenance.js";

export {
  logOperationalEvent,
  type OperationalLogEvent,
  type OperationalLogSeverity,
} from "./observability.js";
