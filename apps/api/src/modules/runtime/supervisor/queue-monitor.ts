import type { ClockPort, MissionQueuePort, WorkerRegistryPort } from "./ports.js";
import type { QueueScanReport, WorkerScanReport } from "./types.js";

/**
 * QueueMonitor — observa profundidade, congestao e workers.
 * Apenas metricas. Nao decide negocio.
 */
export class QueueMonitor {
  constructor(
    private readonly queue: MissionQueuePort,
    private readonly workers: WorkerRegistryPort,
    private readonly clock: ClockPort,
    private readonly staleRunningMs: number,
    private readonly congestionThreshold = 10,
  ) {}

  async scan(): Promise<{ queue: QueueScanReport; workers: WorkerScanReport }> {
    const depths = await this.queue.depths();
    const [failed, running] = await Promise.all([
      this.queue.list({ status: "FAILED", take: 100 }),
      this.queue.list({ status: "RUNNING", take: 100 }),
    ]);

    const now = this.clock.now().getTime();
    const retry = failed.filter((m) => m.attempt < m.maxAttempts).length;
    const stuck = running.filter((m) => {
      const anchor = m.updatedAt ?? m.startedAt;
      return anchor ? now - anchor.getTime() >= this.staleRunningMs : false;
    }).length;

    const list = this.workers.list();
    const busy = list.filter((w) => w.status === "busy").length;
    const available = list.filter(
      (w) => w.status === "idle" || w.status === "starting",
    ).length;
    const stopped = list.filter((w) => w.status === "stopped").length;
    const alive = this.workers.aliveCount();
    const depth = depths.queued + depths.running + depths.waiting;

    const workersReport: WorkerScanReport = {
      alive,
      total: list.length,
      stopped,
      busy,
      available,
    };

    const queue: QueueScanReport = {
      scannedAt: this.clock.now().toISOString(),
      pending: depths.queued,
      running: depths.running,
      failed: depths.failed,
      waiting: depths.waiting,
      retry,
      stuck,
      depth,
      congested: depth >= this.congestionThreshold,
      workersAvailable: available,
      workersBusy: busy,
      depths,
    };

    return { queue, workers: workersReport };
  }
}

/** Alias legado. */
export { QueueMonitor as QueueScanner };
