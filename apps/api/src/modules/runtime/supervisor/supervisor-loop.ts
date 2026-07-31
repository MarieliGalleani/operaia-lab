import type { CoordinationDispatcher } from "./coordination-dispatcher.js";
import type { HealthMonitor } from "./health-monitor.js";
import type { GitHubRepositoryScanner } from "./github-repository-scanner.js";
import type { MissionScanner } from "./mission-scanner.js";
import type {
  SnapshotStorePort,
  SupervisorLoggerPort,
} from "./ports.js";
import type { QueueMonitor } from "./queue-monitor.js";
import type { RecoveryCoordinator } from "./recovery-coordinator.js";
import { SnapshotGenerator } from "./snapshot-generator.js";
import type { SignalDecisionEngine } from "../signal-decision-engine.js";
import type { WorkspaceScanner } from "./workspace-scanner.js";
import type { OperationalSnapshot, SupervisorCycleContext } from "./types.js";
import { SupervisorEvent } from "./types.js";

export interface SupervisorLoopDeps {
  readonly healthMonitor: HealthMonitor;
  readonly workspaceScanner: WorkspaceScanner;
  readonly missionScanner: MissionScanner;
  readonly queueMonitor: QueueMonitor;
  readonly recoveryCoordinator: RecoveryCoordinator;
  readonly coordinationDispatcher: CoordinationDispatcher;
  readonly snapshots: SnapshotGenerator;
  readonly snapshotStore: SnapshotStorePort;
  readonly logger: SupervisorLoggerPort;
  readonly intervalMs: number;
  readonly staleRunningMs: number;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Opcional: visao operacional GitHub (bindings existentes). */
  readonly githubRepositoryScanner?: GitHubRepositoryScanner;
  /** Opcional: decisao operacional sobre sinais emitidos no scan. */
  readonly signalDecisionEngine?: SignalDecisionEngine;
}

/**
 * SupervisorLoop — servico operacional permanente.
 *
 * health → workspace scan → github repo scan → mission scan → queue scan →
 * recover stale → dispatch coordination → sleep
 *
 * NUNCA toma decisoes de negocio.
 */
export class SupervisorLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private running = false;
  private cycle = 0;
  private lastSnapshot: OperationalSnapshot | null = null;
  private startedAt: number | null = null;

  constructor(private readonly deps: SupervisorLoopDeps) {}

  get isRunning(): boolean {
    return this.running;
  }

  getLastSnapshot(): OperationalSnapshot | null {
    return this.lastSnapshot;
  }

  status() {
    return {
      running: this.running,
      cycle: this.cycle,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      lastSnapshotAt: this.lastSnapshot?.timestamp ?? null,
    };
  }

  start(): void {
    if (this.timer || this.running) {
      return;
    }
    this.running = true;
    this.startedAt = Date.now();
    this.deps.logger.emit(SupervisorEvent.SUPERVISOR_STARTED, {
      intervalMs: this.deps.intervalMs,
    });
    void this.runCycle();
    this.timer = setInterval(() => void this.runCycle(), this.deps.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    while (this.ticking) {
      await (this.deps.sleep ?? defaultSleep)(50);
    }
    this.running = false;
    this.deps.logger.emit(SupervisorEvent.SUPERVISOR_STOPPED, {
      cycles: this.cycle,
    });
  }

  async runCycle(): Promise<SupervisorCycleContext | null> {
    if (this.ticking) {
      return null;
    }
    this.ticking = true;
    this.cycle += 1;

    try {
      const health = await this.deps.healthMonitor.run();
      this.deps.logger.emit(SupervisorEvent.HEALTH_CHECK, {
        overall: health.overall,
        components: health.components.length,
      });
      if (health.overall === "ok") {
        this.deps.logger.emit(SupervisorEvent.HEALTH_OK, {
          components: health.components.length,
        });
      } else {
        this.deps.logger.emit(SupervisorEvent.HEALTH_FAIL, {
          overall: health.overall,
        });
      }

      const workspaces = await this.deps.workspaceScanner.scan();
      this.deps.logger.emit(SupervisorEvent.WORKSPACE_SCANNED, {
        active: workspaces.activeCount,
        attention: workspaces.attentionCount,
      });

      if (this.deps.githubRepositoryScanner) {
        const activeWorkspaceIds = workspaces.workspaces
          .filter((ws) => ws.status === "ACTIVE")
          .map((ws) => ws.workspaceId);
        const github = await this.deps.githubRepositoryScanner.scan({
          activeWorkspaceIds,
        });
        this.deps.logger.emit(SupervisorEvent.GITHUB_REPOS_SCANNED, {
          scanned: github.scanned,
          updated: github.updated,
          signalsEmitted: github.signalsEmitted,
          skipped: github.skipped,
          errors: github.errors,
        });

        if (this.deps.signalDecisionEngine) {
          const decisions =
            await this.deps.signalDecisionEngine.processGithubScan(github);
          this.deps.logger.emit(SupervisorEvent.SIGNAL_DECISIONS, {
            processed: decisions.length,
            converted: decisions.filter((d) => d.outcome === "converted")
              .length,
            ignored: decisions.filter((d) => d.outcome === "ignored").length,
            deferred: decisions.filter((d) => d.outcome === "deferred")
              .length,
          });
        }
      }

      const missions = await this.deps.missionScanner.scan();
      this.deps.logger.emit(SupervisorEvent.MISSION_SCANNED, {
        items: missions.items.length,
        coordinationNeeded: missions.coordinationNeeded,
        byStatus: missions.byStatus,
      });

      const { queue, workers } = await this.deps.queueMonitor.scan();
      this.deps.logger.emit(SupervisorEvent.QUEUE_SCANNED, {
        depth: queue.depth,
        congested: queue.congested,
        workersAvailable: queue.workersAvailable,
        workersBusy: queue.workersBusy,
      });

      const recovery = await this.deps.recoveryCoordinator.recover({
        missions,
        queue,
        workspaces,
      });

      const dispatch = await this.deps.coordinationDispatcher.dispatch({
        workspaces,
        missions,
        queue,
        recovery,
        healthOk: health.overall !== "fail",
      });

      const snapshot = this.deps.snapshots.build({
        cycle: this.cycle,
        health,
        workspaces,
        missions,
        queue,
        workers,
        dispatch,
        recovery,
      });
      await this.deps.snapshotStore.save(snapshot);
      this.lastSnapshot = snapshot;
      this.deps.logger.emit(SupervisorEvent.SNAPSHOT_PERSISTED, {
        cycle: this.cycle,
      });

      this.deps.logger.emit(SupervisorEvent.SUPERVISOR_CYCLE, {
        cycle: this.cycle,
        dispatched: dispatch.dispatched,
        recovered: recovery.infraRecovered,
      });

      this.deps.logger.emit(SupervisorEvent.SUPERVISOR_SLEEP, {
        intervalMs: this.deps.intervalMs,
        cycle: this.cycle,
      });

      return {
        cycle: this.cycle,
        health,
        workspaces,
        missions,
        queue,
        workers,
        recovery,
        dispatch,
        snapshot,
      };
    } finally {
      this.ticking = false;
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
