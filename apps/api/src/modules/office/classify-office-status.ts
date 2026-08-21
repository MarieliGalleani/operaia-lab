/**
 * Classificação determinística do Status do Escritório.
 * NÃO usa LLM. Critérios explícitos e auditáveis.
 * Não inventa thresholds: só usa sinais já existentes no runtime.
 */

export type OfficeLevel = "OPERATING" | "ATTENTION" | "PROBLEM";

export interface OfficeClassificationInput {
  readonly healthOk: boolean;
  readonly readyOk: boolean;
  readonly runtimeStarted: boolean;
  readonly supervisorRunning: boolean;
  readonly workersAlive: number;
  readonly workersExpected: number;
  /** Health do último snapshot do Supervisor (ok | degraded | fail). */
  readonly supervisorHealthOverall: "ok" | "degraded" | "fail" | null;
  /** FAILED com finishedAt nas últimas 24h — não confundir com histórico. */
  readonly failedNew24h: number;
  readonly pendingHumanApprovals: number;
  /** Último ciclo do Supervisor reportou recovery infra. */
  readonly recoveryRecent: boolean;
  /** Flag já existente em QueueScanReport.congested. */
  readonly queueCongested: boolean;
  /** Sinais DomainSignal com evaluationDecision=DEFER nas últimas 24h. */
  readonly signalDefer24h: number;
}

export interface OfficeClassificationResult {
  readonly level: OfficeLevel;
  readonly label: string;
  readonly summary: string;
  readonly reasons: readonly string[];
}

export function classifyOfficeStatus(
  input: OfficeClassificationInput,
): OfficeClassificationResult {
  const reasons: string[] = [];

  if (!input.healthOk) {
    reasons.push("health_failure");
  }
  if (!input.readyOk) {
    reasons.push("ready_failure");
  }
  if (input.runtimeStarted && input.workersAlive === 0) {
    reasons.push("workers_unavailable");
  }
  if (input.runtimeStarted && !input.supervisorRunning) {
    reasons.push("supervisor_stopped");
  }
  if (input.supervisorHealthOverall === "fail") {
    reasons.push("supervisor_health_fail");
  }

  if (reasons.length > 0) {
    return {
      level: "PROBLEM",
      label: "PROBLEMA",
      summary: "Há um problema operacional que precisa de atenção.",
      reasons,
    };
  }

  if (input.supervisorHealthOverall === "degraded") {
    reasons.push("supervisor_health_degraded");
  }
  if (
    input.workersExpected > 0 &&
    input.workersAlive < input.workersExpected
  ) {
    reasons.push("workers_partial");
  }
  if (input.failedNew24h > 0) {
    reasons.push("failed_new_24h");
  }
  if (input.pendingHumanApprovals > 0) {
    reasons.push("pending_human_approval");
  }
  if (input.recoveryRecent) {
    reasons.push("recovery_recent");
  }
  if (input.queueCongested) {
    reasons.push("queue_congested");
  }
  if (input.signalDefer24h > 0) {
    reasons.push("signal_defer_24h");
  }

  if (reasons.length > 0) {
    return {
      level: "ATTENTION",
      label: "ATENÇÃO",
      summary: "O escritório opera, mas há itens que merecem olhar.",
      reasons,
    };
  }

  return {
    level: "OPERATING",
    label: "OPERANDO",
    summary: "Todos os sistemas principais estão funcionando.",
    reasons: [],
  };
}
