import type { MemoryStore } from "@operaia/memory";
import { prisma } from "@operaia/database";
import type { DigitalOffice } from "../employees/office-composition.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import {
  createDefaultImprovementEngine,
  type ImprovementEngine,
  type ImprovementInsight,
} from "../improvement/improvement-engine.js";
import { GovernanceService } from "../governance/governance-service.js";
import { buildWorkspacePortfolioSnapshot } from "../organization/workspace-portfolio.js";
import {
  createMissionExecutionStack,
  type MissionExecutionStack,
} from "../operations/mission-execution.js";
import type { ProjectRepository } from "../projects/domain/project.repository.js";
import type { TaskRepository } from "../tasks/domain/task.repository.js";
import type { EmployeeWorkerLogger } from "./employee-worker.js";
import { MissionQueue } from "./mission-queue.js";
import { MissionScheduler } from "./mission-scheduler.js";
import {
  runProductionReadiness,
  type ProductionReadinessReport,
} from "./production-readiness.js";
import { QueuedMissionExecutor } from "./queued-mission-executor.js";
import { WorkerManager } from "./worker-manager.js";

export interface ContinuousRuntimeConfig {
  readonly office: DigitalOffice;
  readonly workspaces: WorkspaceSource;
  readonly projects: ProjectRepository;
  readonly tasks: TaskRepository;
  readonly execution: MissionExecutionStack;
  readonly memory: MemoryStore;
  readonly logger: EmployeeWorkerLogger;
  readonly enabled: boolean;
  readonly pollIntervalMs: number;
  readonly heartbeatIntervalMs: number;
  readonly schedulerIntervalMs: number;
  readonly staleRunningMs: number;
}

/**
 * Runtime continuo: readiness → recovery → workers → scheduler.
 */
export class ContinuousRuntime {
  readonly queue = new MissionQueue();
  readonly executor: QueuedMissionExecutor;
  readonly workers: WorkerManager;
  readonly scheduler: MissionScheduler;
  readonly improvement: ImprovementEngine;
  readonly governance = new GovernanceService();
  private readonly startedAt = Date.now();
  private started = false;
  private lastReadiness: ProductionReadinessReport | null = null;
  private lastInsights: readonly ImprovementInsight[] = [];

  constructor(private readonly config: ContinuousRuntimeConfig) {
    this.improvement = createDefaultImprovementEngine();
    this.executor = new QueuedMissionExecutor(
      config.office,
      config.workspaces,
      this.queue,
      config.execution,
      config.memory,
      config.logger,
    );
    this.workers = new WorkerManager({
      office: config.office,
      queue: this.queue,
      executor: this.executor,
      pollIntervalMs: config.pollIntervalMs,
      heartbeatIntervalMs: config.heartbeatIntervalMs,
      logger: config.logger,
    });
    this.scheduler = new MissionScheduler({
      queue: this.queue,
      workspaces: config.workspaces,
      projects: config.projects,
      tasks: config.tasks,
      intervalMs: config.schedulerIntervalMs,
      logger: config.logger,
      improvement: this.improvement,
      governance: this.governance,
      onInsights: (insights) => {
        this.lastInsights = insights;
      },
    });
    this.executor.setPortfolioProvider(async () => {
      if (this.scheduler.getLastSnapshot()) {
        return this.scheduler.getLastSnapshot();
      }
      return buildWorkspacePortfolioSnapshot({
        projects: config.projects,
        tasks: config.tasks,
        queue: this.queue,
      });
    });
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  getLastReadiness(): ProductionReadinessReport | null {
    return this.lastReadiness;
  }

  getLastInsights(): readonly ImprovementInsight[] {
    return this.lastInsights.length > 0
      ? this.lastInsights
      : this.improvement.getLastInsights();
  }

  async start(): Promise<void> {
    if (!this.config.enabled || this.started) {
      return;
    }

    this.lastReadiness = await runProductionReadiness({
      office: this.config.office,
      queue: this.queue,
      workspaces: this.config.workspaces,
      projects: this.config.projects,
      tasks: this.config.tasks,
      execution: this.config.execution,
      memory: this.config.memory,
      continuousEnabled: this.config.enabled,
    });

    this.config.logger.info(
      {
        component: "continuous-runtime",
        event: "production_readiness",
        overall: this.lastReadiness.overall,
        canStartWorkers: this.lastReadiness.canStartWorkers,
        mandatoryFailed: this.lastReadiness.mandatoryFailed,
        warnings: this.lastReadiness.warnings,
      },
      "Production Readiness checklist",
    );

    if (!this.lastReadiness.canStartWorkers) {
      throw new Error(
        `Production Readiness FAIL — workers nao iniciados: ${this.lastReadiness.mandatoryFailed.join(", ")}`,
      );
    }

    const recoveredRunning = await this.queue.recoverStaleRunning(
      this.config.staleRunningMs,
    );
    const recoveredWaiting = await this.queue.recoverWaitingParents();
    const recoveredDag = await this.queue.recoverBlockedDag();
    this.config.logger.info(
      {
        component: "continuous-runtime",
        event: "recovery",
        recoveredRunning,
        recoveredWaiting,
        recoveredDag,
      },
      "Recuperacao de missoes orfas",
    );

    await this.workers.start();
    this.scheduler.start();
    this.started = true;
    this.config.logger.info(
      {
        component: "continuous-runtime",
        event: "started",
        workers: this.workers.list().length,
        improvementObservers: this.improvement.getObservers(),
      },
      "Runtime continuo iniciado",
    );
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    await this.scheduler.stop();
    await this.workers.stop();
    this.started = false;
    this.config.logger.info(
      { component: "continuous-runtime", event: "stopped" },
      "Runtime continuo parado",
    );
  }

  async snapshot() {
    const depths = await this.queue.depths();
    const scheduler = this.scheduler.snapshot();
    const learningCount = await prisma.missionLearning.count();
    const pendingApprovals = await this.governance.countPending();
    return {
      enabled: this.config.enabled,
      started: this.started,
      uptimeMs: Date.now() - this.startedAt,
      workersAlive: this.workers.aliveCount(),
      workers: this.workers.list(),
      queue: depths,
      scheduler,
      readiness: this.lastReadiness,
      portfolio: this.scheduler.getLastSnapshot(),
      insights: this.getLastInsights(),
      improvementObservers: this.improvement.getObservers(),
      learningCount,
      pendingApprovals,
      structuralApplyAllowed: await this.governance.canApplyStructuralChange(),
    };
  }
}

export { createMissionExecutionStack };
