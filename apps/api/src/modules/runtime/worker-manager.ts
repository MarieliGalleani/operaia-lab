import type { DigitalOffice } from "../employees/office-composition.js";
import {
  EmployeeWorker,
  type EmployeeWorkerLogger,
} from "./employee-worker.js";
import type { MissionQueue } from "./mission-queue.js";
import type { QueuedMissionExecutor } from "./queued-mission-executor.js";
import type { WorkerPublicView } from "./runtime-metrics.js";

export interface WorkerManagerOptions {
  readonly office: DigitalOffice;
  readonly queue: MissionQueue;
  readonly executor: QueuedMissionExecutor;
  readonly pollIntervalMs: number;
  readonly heartbeatIntervalMs: number;
  readonly logger: EmployeeWorkerLogger;
}

/**
 * Sobe um EmployeeWorker por entrada do Registry (roster).
 */
export class WorkerManager {
  private readonly workers = new Map<string, EmployeeWorker>();

  constructor(private readonly options: WorkerManagerOptions) {}

  async start(): Promise<void> {
    for (const registered of this.options.office.registry.all()) {
      const worker = new EmployeeWorker({
        profile: registered.profile,
        queue: this.options.queue,
        executor: this.options.executor,
        pollIntervalMs: this.options.pollIntervalMs,
        heartbeatIntervalMs: this.options.heartbeatIntervalMs,
        logger: this.options.logger,
      });
      this.workers.set(registered.profile.id, worker);
      await worker.start();
    }
  }

  async stop(): Promise<void> {
    const stops = [...this.workers.values()].map((worker) => worker.stop());
    await Promise.all(stops);
    this.workers.clear();
  }

  list(): readonly WorkerPublicView[] {
    return [...this.workers.values()].map((worker) => worker.view());
  }

  aliveCount(): number {
    return this.list().filter(
      (worker) =>
        worker.status === "idle" ||
        worker.status === "busy" ||
        worker.status === "starting",
    ).length;
  }
}
