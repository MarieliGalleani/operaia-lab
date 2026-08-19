/**
 * Tipos do Operational Supervisor v2 — infraestrutura operacional, nao Employee.
 * Invariante: nunca contem regras de negocio.
 */

export const SupervisorEvent = {
  SUPERVISOR_STARTED: "SUPERVISOR_STARTED",
  HEALTH_CHECK: "HEALTH_CHECK",
  WORKSPACE_SCANNED: "WORKSPACE_SCANNED",
  MISSION_SCANNED: "MISSION_SCANNED",
  QUEUE_SCANNED: "QUEUE_SCANNED",
  RECOVERY_CREATED: "RECOVERY_CREATED",
  COORDINATION_CREATED: "COORDINATION_CREATED",
  SUPERVISOR_SLEEP: "SUPERVISOR_SLEEP",
  SUPERVISOR_STOPPED: "SUPERVISOR_STOPPED",
  /** Compat / diagnostico */
  SUPERVISOR_CYCLE: "SUPERVISOR_CYCLE",
  HEALTH_OK: "HEALTH_OK",
  HEALTH_FAIL: "HEALTH_FAIL",
  SNAPSHOT_PERSISTED: "SNAPSHOT_PERSISTED",
  GITHUB_REPOS_SCANNED: "GITHUB_REPOS_SCANNED",
  SIGNAL_DECISIONS: "SIGNAL_DECISIONS",
  /** A.5.3 — alerta operacional interno (nao cria missao). */
  OPERATIONAL_ALERT: "OPERATIONAL_ALERT",
  MAINTENANCE_RAN: "MAINTENANCE_RAN",
  /** F6.2 — tick de ScheduleRule recorrente (sem portfolio/latch). */
  SCHEDULE_RULES_TICK: "SCHEDULE_RULES_TICK",
} as const;

export type SupervisorEvent =
  (typeof SupervisorEvent)[keyof typeof SupervisorEvent];

export type HealthStatus = "ok" | "degraded" | "fail";

export interface HealthComponentReport {
  readonly name: string;
  readonly status: HealthStatus;
  readonly detail: string;
}

export interface HealthReport {
  readonly checkedAt: string;
  readonly overall: HealthStatus;
  readonly components: readonly HealthComponentReport[];
}

export type CoordinationReason =
  | "novo_workspace"
  | "missao_parada"
  | "missao_bloqueada"
  | "missao_aguardando"
  | "retry"
  | "recuperacao"
  | "backlog"
  | "mudanca_importante"
  | "congestionamento_fila"
  | "acompanhamento_periodico";

export interface WorkspaceScanItem {
  readonly workspaceId: string;
  readonly name: string;
  readonly status: string;
  readonly projectId: string;
  readonly pendingTasks: number;
  readonly teamSize: number;
  readonly hasActiveMission: boolean;
  readonly hasBlockedMission: boolean;
  readonly hasWaitingMission: boolean;
  readonly hasReadyMission: boolean;
  readonly hasBacklog: boolean;
  readonly hasChanges: boolean;
  readonly needsAttention: boolean;
  readonly attentionReasons: readonly CoordinationReason[];
  readonly openMissions: number;
  readonly ready: boolean;
  readonly issues: readonly string[];
}

export interface WorkspaceScanReport {
  readonly scannedAt: string;
  readonly workspaces: readonly WorkspaceScanItem[];
  readonly activeCount: number;
  readonly readyCount: number;
  readonly attentionCount: number;
}

export type MissionScanCategory =
  | "CREATED"
  | "WAITING"
  | "RUNNING"
  | "BLOCKED"
  | "FAILED"
  | "COMPLETED"
  | "QUEUED"
  | "RETRY"
  | "STALE"
  | "TIMEOUT";

export interface MissionScanItem {
  readonly missionId: string;
  readonly workspaceId: string;
  readonly status: string;
  readonly category: MissionScanCategory;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly canResume: boolean;
  readonly needsCoordination: boolean;
  readonly reason: string;
}

export interface MissionScanReport {
  readonly scannedAt: string;
  readonly items: readonly MissionScanItem[];
  readonly resumableCount: number;
  readonly coordinationNeeded: number;
  readonly byStatus: Readonly<Record<string, number>>;
}

export interface QueueScanReport {
  readonly scannedAt: string;
  readonly pending: number;
  readonly running: number;
  readonly failed: number;
  readonly waiting: number;
  readonly retry: number;
  readonly stuck: number;
  readonly depth: number;
  readonly congested: boolean;
  readonly workersAvailable: number;
  readonly workersBusy: number;
  readonly depths: {
    readonly queued: number;
    readonly running: number;
    readonly waiting: number;
    readonly failed: number;
  };
}

export interface WorkerScanReport {
  readonly alive: number;
  readonly total: number;
  readonly stopped: number;
  readonly busy: number;
  readonly available: number;
}

export interface RecoveryAction {
  readonly kind: "stale" | "waiting" | "blocked" | "timeout" | "failed_retry";
  readonly count: number;
  readonly reason: string;
  readonly createCoordination: boolean;
}

export interface RecoveryReport {
  readonly recoveredAt: string;
  readonly actions: readonly RecoveryAction[];
  readonly infraRecovered: number;
  readonly coordinationsRequested: number;
}

export interface CoordinationRequest {
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly reason: CoordinationReason;
  readonly detail: string;
}

export interface DispatchResult {
  readonly dispatched: number;
  readonly skipped: number;
  readonly recovered: number;
  readonly details: readonly string[];
  readonly coordinations: readonly CoordinationRequest[];
}

export interface OperationalSnapshot {
  readonly timestamp: string;
  readonly cycle: number;
  readonly health: HealthReport;
  readonly workspace: {
    readonly active: number;
    readonly ready: number;
    readonly attention: number;
    readonly items: readonly WorkspaceScanItem[];
  };
  readonly workers: WorkerScanReport;
  readonly queue: QueueScanReport;
  readonly missions: {
    readonly resumable: number;
    readonly coordinationNeeded: number;
    readonly items: readonly MissionScanItem[];
  };
  readonly running: number;
  readonly completed: number;
  readonly failed: number;
  readonly dispatch: DispatchResult;
  readonly recovery: RecoveryReport;
}

export interface SupervisorCycleContext {
  readonly cycle: number;
  readonly health: HealthReport;
  readonly workspaces: WorkspaceScanReport;
  readonly missions: MissionScanReport;
  readonly queue: QueueScanReport;
  readonly workers: WorkerScanReport;
  readonly recovery: RecoveryReport;
  readonly dispatch: DispatchResult;
  readonly snapshot: OperationalSnapshot;
}

/** Acao operacional pedida por uma politica (sem regra de negocio). */
export type PolicyActionType =
  | "recover_queue"
  | "recover_workers"
  | "dispatch_coordinate"
  | "skip";

export interface PolicyAction {
  readonly policy: string;
  readonly type: PolicyActionType;
  readonly reason: string;
  readonly count?: number;
  readonly workspaceId?: string;
}

export interface PolicyEvaluationResult {
  readonly evaluatedAt: string;
  readonly actions: readonly PolicyAction[];
}
