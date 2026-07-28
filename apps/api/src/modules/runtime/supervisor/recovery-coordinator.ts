import type { ClockPort, MissionQueuePort, SupervisorLoggerPort } from "./ports.js";
import type {
  MissionScanReport,
  QueueScanReport,
  RecoveryAction,
  RecoveryReport,
  WorkspaceScanReport,
} from "./types.js";
import { SupervisorEvent } from "./types.js";

/**
 * RecoveryCoordinator — detecta missao parada/esquecida/timeout.
 * Pode recuperar infraestrutura de fila e solicitar COORDINATE para Opera.
 * Nunca altera regras de negocio.
 */
export class RecoveryCoordinator {
  constructor(
    private readonly queue: MissionQueuePort,
    private readonly logger: SupervisorLoggerPort,
    private readonly clock: ClockPort,
    private readonly staleRunningMs: number,
  ) {}

  async recover(input: {
    readonly missions: MissionScanReport;
    readonly queue: QueueScanReport;
    readonly workspaces: WorkspaceScanReport;
  }): Promise<RecoveryReport> {
    const actions: RecoveryAction[] = [];
    let infraRecovered = 0;

    const staleCount =
      input.missions.items.filter((m) => m.category === "STALE" || m.category === "TIMEOUT")
        .length || input.queue.stuck;
    if (staleCount > 0) {
      const n = await this.queue.recoverStaleRunning(this.staleRunningMs);
      infraRecovered += n;
      actions.push({
        kind: "stale",
        count: Math.max(n, staleCount),
        reason: "execucao RUNNING interrompida/stale",
        createCoordination: true,
      });
    }

    if (input.queue.waiting > 0) {
      const n = await this.queue.recoverWaitingParents();
      infraRecovered += n;
      actions.push({
        kind: "waiting",
        count: Math.max(n, input.queue.waiting),
        reason: "WAITING parents / consolidacao",
        createCoordination: n > 0 || input.queue.waiting > 0,
      });
    }

    const blocked = input.missions.items.filter((m) => m.category === "BLOCKED");
    if (blocked.length > 0) {
      const n = await this.queue.recoverBlockedDag();
      infraRecovered += n;
      actions.push({
        kind: "blocked",
        count: Math.max(n, blocked.length),
        reason: "missoes BLOCKED na DAG",
        createCoordination: true,
      });
    }

    const coordinationsRequested = actions.filter((a) => a.createCoordination).length;
    if (actions.length > 0) {
      this.logger.emit(SupervisorEvent.RECOVERY_CREATED, {
        infraRecovered,
        coordinationsRequested,
        actions: actions.map((a) => a.kind),
      });
    }

    return {
      recoveredAt: this.clock.now().toISOString(),
      actions,
      infraRecovered,
      coordinationsRequested,
    };
  }
}
