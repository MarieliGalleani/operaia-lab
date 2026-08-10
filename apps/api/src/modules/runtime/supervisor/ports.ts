/**
 * Ports do Operational Supervisor v2 — somente interfaces (DI).
 * Supervisor nunca acessa Prisma diretamente.
 */
import type {
  HealthReport,
  MissionScanReport,
  OperationalSnapshot,
  QueueScanReport,
  SupervisorEvent,
  WorkerScanReport,
  WorkspaceScanReport,
} from "./types.js";

/** Relogio injetavel (testes deterministicos). */
export interface ClockPort {
  now(): Date;
}

/** Persistencia de snapshots operacionais. */
export interface SnapshotStorePort {
  save(snapshot: OperationalSnapshot): Promise<void>;
  latest(): Promise<OperationalSnapshot | null>;
  list(limit?: number): Promise<readonly OperationalSnapshot[]>;
}

/** Estatisticas de aprendizado organizacional (sem Prisma no Supervisor). */
export interface LearningStatsPort {
  count(): Promise<number>;
}

export interface ScheduleRuleRecord {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly intervalSec: number;
  readonly lastEnqueuedAt: Date | null;
  readonly objective?: string;
}

/** Regras de schedule recorrente. */
export interface ScheduleRulePort {
  listEnabled(): Promise<readonly ScheduleRuleRecord[]>;
  markEnqueued(id: string, at: Date): Promise<void>;
}

export interface QueueDepthsView {
  readonly queued: number;
  readonly running: number;
  readonly waiting: number;
  readonly failed: number;
}

export interface MissionView {
  readonly id: string;
  readonly workspaceId: string;
  readonly status: string;
  readonly readiness: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly updatedAt: Date;
  readonly startedAt: Date | null;
  readonly lastError: string | null;
  readonly missionKind: string;
}

/** Porta da fila operacional — abstrai MissionQueue. */
export interface MissionQueuePort {
  depths(): Promise<QueueDepthsView>;
  list(filters?: {
    readonly status?: string;
    readonly workspaceId?: string;
    readonly take?: number;
  }): Promise<readonly MissionView[]>;
  recoverStaleRunning(staleAfterMs: number): Promise<number>;
  recoverWaitingParents(): Promise<number>;
  recoverBlockedDag(): Promise<number>;
  enqueue(input: {
    readonly workspaceId: string;
    readonly projectId?: string | null;
    readonly objective: string;
    readonly ownerEmployeeId: string;
    readonly priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    readonly dedupe?: boolean;
  }): Promise<{ readonly created: boolean; readonly id?: string }>;
  /**
   * Busca missao por objectiveHash (recovery de latch PENDING orfao).
   * Opcional nos mocks legados; Prisma adapter implementa.
   */
  findByObjectiveHash?(
    workspaceId: string,
    objectiveHash: string,
    options?: { readonly createdAtGte?: Date },
  ): Promise<{ readonly id: string; readonly status: string } | null>;
}

export interface WorkerViewPort {
  readonly employeeId: string;
  readonly status: string;
}

/** Observabilidade de workers (sem acoplar EmployeeWorker). */
export interface WorkerRegistryPort {
  list(): readonly WorkerViewPort[];
  aliveCount(): number;
}

/** Health checks injetaveis por componente. */
export interface HealthCheckPort {
  readonly name: string;
  check(): Promise<{ readonly status: "ok" | "degraded" | "fail"; readonly detail: string }>;
}

/** Logger estruturado do Supervisor. */
export interface SupervisorLoggerPort {
  emit(
    event: SupervisorEvent,
    data?: Readonly<Record<string, unknown>>,
  ): void;
}

export interface SupervisorScanPorts {
  readonly clock: ClockPort;
  readonly queue: MissionQueuePort;
  readonly workers: WorkerRegistryPort;
  readonly healthChecks: readonly HealthCheckPort[];
  readonly scanWorkspaces: () => Promise<WorkspaceScanReport>;
  readonly scanMissions: () => Promise<MissionScanReport>;
  readonly scanQueue: () => Promise<QueueScanReport>;
  readonly scanWorkers: () => WorkerScanReport;
}

export type {
  HealthReport,
  MissionScanReport,
  OperationalSnapshot,
  QueueScanReport,
  WorkspaceScanReport,
};
