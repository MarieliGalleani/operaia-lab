import type { MemoryStore } from "@operaia/memory";
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
import { createOperationalSupervisor } from "./supervisor/create-operational-supervisor.js";
import { PrismaLearningStatsAdapter } from "./supervisor/infrastructure/prisma-learning-stats-adapter.js";
import { PrismaScheduleRuleAdapter } from "./supervisor/infrastructure/prisma-schedule-rule-adapter.js";
import type { SupervisorLoop } from "./supervisor/supervisor-loop.js";
import type { OperationalSnapshot } from "./supervisor/types.js";
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
 * Runtime continuo: readiness → recovery → workers → Operational Supervisor v2.
 */
export class ContinuousRuntime {
  readonly queue = new MissionQueue();
  readonly executor: QueuedMissionExecutor;
  readonly workers: WorkerManager;
  readonly scheduler: MissionScheduler;
  readonly supervisor: SupervisorLoop;
  readonly eventStore: ReturnType<
    typeof createOperationalSupervisor
  >["eventStore"];
  readonly improvement: ImprovementEngine;
  readonly governance = new GovernanceService();
  private readonly learningStats = new PrismaLearningStatsAdapter();
  private readonly scheduleRules = new PrismaScheduleRuleAdapter();
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
      learningStats: this.learningStats,
      scheduleRules: this.scheduleRules,
      onInsights: (insights) => {
        this.lastInsights = insights;
      },
    });
    const bundle = createOperationalSupervisor({
      office: config.office,
      workspaces: config.workspaces,
      queue: this.queue,
      workers: this.workers,
      execution: config.execution,
      memory: config.memory,
      scheduler: this.scheduler,
      learningStats: this.learningStats,
      intervalMs: config.schedulerIntervalMs,
      staleRunningMs: config.staleRunningMs,
      logger: config.logger,
    });
    this.supervisor = bundle.supervisor;
    this.eventStore = bundle.eventStore;
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

  getLastOperationalSnapshot(): OperationalSnapshot | null {
    return this.supervisor.getLastSnapshot();
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
    // Supervisor v2: Health → Scan → Recover → Dispatch COORDINATE → Snapshot.
    // MissionScheduler nao e chamado pelo Supervisor — permanece disponivel para a Opera.
    this.supervisor.start();
    this.started = true;
    this.config.logger.info(
      {
        component: "continuous-runtime",
        event: "started",
        workers: this.workers.list().length,
        supervisor: true,
        improvementObservers: this.improvement.getObservers(),
      },
      "Runtime continuo + Operational Supervisor v2 iniciado",
    );
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    await this.supervisor.stop();
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
    const supervisor = this.supervisor.status();
    const learningCount = await this.learningStats.count();
    const pendingApprovals = await this.governance.countPending();
    const events = await this.eventStore.list(30);
    return {
      enabled: this.config.enabled,
      started: this.started,
      uptimeMs: Date.now() - this.startedAt,
      workersAlive: this.workers.aliveCount(),
      workers: this.workers.list(),
      queue: depths,
      scheduler: {
        ...scheduler,
        // Sob Supervisor v2 o timer do scheduler fica off; o loop e do supervisor.
        running: supervisor.running,
      },
      supervisor,
      operationalSnapshot: this.supervisor.getLastSnapshot(),
      operationalEvents: events,
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
