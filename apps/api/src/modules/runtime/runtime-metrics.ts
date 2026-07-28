export interface WorkerMetricsSnapshot {
  readonly missionsCompleted: number;
  readonly missionsFailed: number;
  readonly retries: number;
  readonly lastExecutionAt: string | null;
  readonly lastDurationMs: number | null;
  readonly totalDurationMs: number;
}

export type WorkerRuntimeStatus =
  | "starting"
  | "idle"
  | "busy"
  | "stopping"
  | "stopped"
  | "error";

export interface WorkerPublicView {
  readonly employeeId: string;
  readonly name: string;
  readonly specialization: string;
  readonly status: WorkerRuntimeStatus;
  readonly currentMissionId: string | null;
  readonly heartbeatAt: string | null;
  readonly uptimeMs: number;
  readonly missionsCompleted: number;
  readonly missionsFailed: number;
  readonly retries: number;
  readonly lastExecutionAt: string | null;
  readonly avgDurationMs: number | null;
}

/**
 * Metricas in-process por worker (espelhadas no heartbeat Postgres).
 */
export class WorkerMetrics {
  private missionsCompleted = 0;
  private missionsFailed = 0;
  private retries = 0;
  private lastExecutionAt: string | null = null;
  private lastDurationMs: number | null = null;
  private totalDurationMs = 0;

  recordSuccess(durationMs: number): void {
    this.missionsCompleted += 1;
    this.lastDurationMs = durationMs;
    this.totalDurationMs += durationMs;
    this.lastExecutionAt = new Date().toISOString();
  }

  recordFailure(durationMs: number, wasRetry: boolean): void {
    this.missionsFailed += 1;
    if (wasRetry) {
      this.retries += 1;
    }
    this.lastDurationMs = durationMs;
    this.totalDurationMs += durationMs;
    this.lastExecutionAt = new Date().toISOString();
  }

  snapshot(): WorkerMetricsSnapshot {
    return {
      missionsCompleted: this.missionsCompleted,
      missionsFailed: this.missionsFailed,
      retries: this.retries,
      lastExecutionAt: this.lastExecutionAt,
      lastDurationMs: this.lastDurationMs,
      totalDurationMs: this.totalDurationMs,
    };
  }

  averageDurationMs(): number | null {
    const n = this.missionsCompleted + this.missionsFailed;
    if (n === 0) {
      return null;
    }
    return Math.round(this.totalDurationMs / n);
  }
}
