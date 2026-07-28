import type { ClockPort } from "./ports.js";
import type {
  DispatchResult,
  HealthReport,
  MissionScanReport,
  OperationalSnapshot,
  QueueScanReport,
  RecoveryReport,
  WorkerScanReport,
  WorkspaceScanReport,
} from "./types.js";

/**
 * SnapshotGenerator — snapshot periodico do estado operacional.
 */
export class SnapshotGenerator {
  constructor(private readonly clock: ClockPort) {}

  build(input: {
    readonly cycle: number;
    readonly health: HealthReport;
    readonly workspaces: WorkspaceScanReport;
    readonly missions: MissionScanReport;
    readonly queue: QueueScanReport;
    readonly workers: WorkerScanReport;
    readonly dispatch: DispatchResult;
    readonly recovery: RecoveryReport;
    readonly completedHint?: number;
  }): OperationalSnapshot {
    return {
      timestamp: this.clock.now().toISOString(),
      cycle: input.cycle,
      health: input.health,
      workspace: {
        active: input.workspaces.activeCount,
        ready: input.workspaces.readyCount,
        attention: input.workspaces.attentionCount,
        items: input.workspaces.workspaces,
      },
      workers: input.workers,
      queue: input.queue,
      missions: {
        resumable: input.missions.resumableCount,
        coordinationNeeded: input.missions.coordinationNeeded,
        items: input.missions.items,
      },
      running: input.queue.running,
      completed: input.completedHint ?? input.missions.byStatus.COMPLETED ?? 0,
      failed: input.queue.failed,
      dispatch: input.dispatch,
      recovery: input.recovery,
    };
  }
}
