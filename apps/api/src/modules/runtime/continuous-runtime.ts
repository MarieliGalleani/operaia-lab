import type { DomainSignalService } from "@operaia/domain-signals";
import type { MemoryStore } from "@operaia/memory";
import {
  createEmployeeActionsFactory,
} from "@operaia/employee-runtime";
import type {
  ActionRuntime,
  ExecutionLedger,
} from "@operaia/action-runtime";
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
import { ensureOperationalWorkspaces } from "../projects/ensure-operational-workspaces.js";
import type { TaskRepository } from "../tasks/domain/task.repository.js";
import { createLabActionRuntime } from "./action-runtime-factory.js";
import type { EmployeeWorkerLogger } from "./employee-worker.js";
import { createEmployeeToolsFactory } from "./github-employee-tools-factory.js";
import { MissionQueue } from "./mission-queue.js";
import { MissionScheduler } from "./mission-scheduler.js";
import {
  runProductionReadiness,
  type ProductionReadinessReport,
} from "./production-readiness.js";
import { QueuedMissionExecutor } from "./queued-mission-executor.js";
import { createOperationalSupervisor } from "./supervisor/create-operational-supervisor.js";
import { FetchGithubRepoClient } from "./supervisor/github-repo-client.js";
import { PrismaLearningStatsAdapter } from "./supervisor/infrastructure/prisma-learning-stats-adapter.js";
import { PrismaScheduleRuleAdapter } from "./supervisor/infrastructure/prisma-schedule-rule-adapter.js";
import type { SupervisorLoop } from "./supervisor/supervisor-loop.js";
import type { OperationalSnapshot } from "./supervisor/types.js";
import { WorkerManager } from "./worker-manager.js";
import { GithubApiClient } from "@operaia/tool-runtime";


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
  /** M1.4 — fallback MissionLearning se indice vazio (migracao). */
  readonly allowLearningPrismaFallback?: boolean;
  /**
   * Bootstrap multi-workspace: retorna workspaceIds de bindings enabled.
   * Sem privilegiar NEXO — cada binding garante um Workspace.
   */
  readonly listEnabledBindingWorkspaceIds?: () => Promise<readonly string[]>;
  /**
   * Popula catalogo oficial (Projects + WorkspaceSourceBindings).
   * Idempotente — chamado antes do ensure generico.
   */
  readonly ensureOfficialCatalog?: () => Promise<{
    readonly workspaceIds: readonly string[];
    readonly projectsEnsured: number;
    readonly bindingsUpserted: number;
  }>;
  /** Habilita scan GitHub no ciclo do Operational Supervisor. */
  readonly domainSignals?: DomainSignalService;
  readonly githubToken?: string | null;
  /** AlreadyDoneGate compartilhado com Assisted / webhook. */
  readonly workGovernanceGate?: import("./work-governance/index.js").AlreadyDoneGate;
  /**
   * Roots locais por workspace para LocalInfrastructureAdapter (A.3).
   * Ex.: { "operaia-lab": "/home/ubuntu/operaia-lab" }
   */
  readonly workspaceInfraRoots?: Readonly<Record<string, string>>;
  /**
   * Action Runtime A.5 — default createLabActionRuntime (InMemory ledger).
   * Producao: passar executionLedger Prisma ou actionRuntime pronto.
   */
  readonly actionRuntime?: ActionRuntime;
  readonly executionLedger?: ExecutionLedger;
  readonly workspaceActionTargets?: Readonly<
    Record<string, readonly string[]>
  >;
  /** Default true — injeta actionsFactory no executor (Atlas/Orion). */
  readonly enableWorkerActions?: boolean;
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
  /** Action Runtime compartilhado com workers (A.5). */
  readonly actionRuntime: ActionRuntime;
  private readonly learningStats = new PrismaLearningStatsAdapter();
  private readonly scheduleRules = new PrismaScheduleRuleAdapter();
  private readonly startedAt = Date.now();
  private started = false;
  private lastReadiness: ProductionReadinessReport | null = null;
  private lastInsights: readonly ImprovementInsight[] = [];

  constructor(private readonly config: ContinuousRuntimeConfig) {
    this.improvement = createDefaultImprovementEngine();

    // Um unico transporte GitHub para scanner + Tool Adapter (sem clientes paralelos).
    const sharedGithubApi =
      config.domainSignals || config.githubToken
        ? new GithubApiClient({
            token: config.githubToken,
            userAgent: "operaia-lab-github",
          })
        : null;

    this.actionRuntime =
      config.actionRuntime ??
      createLabActionRuntime({
        executionLedger: config.executionLedger,
        workspaceTargets: config.workspaceActionTargets,
      });

    this.executor = new QueuedMissionExecutor(
      config.office,
      config.workspaces,
      this.queue,
      config.execution,
      config.memory,
      config.logger,
      {
        allowLearningPrismaFallback:
          config.allowLearningPrismaFallback ?? false,
      },
    );
    if (config.domainSignals || config.workspaceInfraRoots) {
      this.executor.setToolsFactory(
        createEmployeeToolsFactory({
          signals: config.domainSignals,
          client: sharedGithubApi ?? undefined,
          token: config.githubToken,
          workspaceInfraRoots: config.workspaceInfraRoots ?? {
            "operaia-lab": process.cwd(),
          },
        }),
      );
    }
    if (config.enableWorkerActions !== false) {
      this.executor.setActionsFactory(
        createEmployeeActionsFactory(this.actionRuntime),
      );
    }
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
      domainSignals: config.domainSignals,
      githubToken: config.githubToken,
      workGovernanceGate: config.workGovernanceGate,
      githubRepoClient: sharedGithubApi
        ? new FetchGithubRepoClient({ client: sharedGithubApi })
        : undefined,
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
    await this.bootstrapWorkspaces();

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

  /**
   * Garante Workspaces a partir do catalogo oficial + bindings enabled.
   * Chamado no start mesmo com continuous disabled (HTTP/ops precisam do catalogo).
   */
  async bootstrapWorkspaces(): Promise<void> {
    if (this.config.ensureOfficialCatalog) {
      const official = await this.config.ensureOfficialCatalog();
      this.config.logger.info(
        {
          component: "continuous-runtime",
          event: "official_catalog_bootstrapped",
          projectsEnsured: official.projectsEnsured,
          bindingsUpserted: official.bindingsUpserted,
          workspaceIds: official.workspaceIds,
        },
        "Catalogo operacional oficial garantido",
      );
    }

    const listIds = this.config.listEnabledBindingWorkspaceIds;
    if (!listIds) {
      return;
    }
    const bindingWorkspaceIds = await listIds();
    const result = await ensureOperationalWorkspaces({
      projects: this.config.projects,
      bindingWorkspaceIds,
    });
    this.config.logger.info(
      {
        component: "continuous-runtime",
        event: "workspaces_bootstrapped",
        bindingCount: bindingWorkspaceIds.length,
        ensured: result.workspaceIds.length,
        created: result.createdIds.length,
        activated: result.activatedIds.length,
        workspaceIds: result.workspaceIds,
      },
      "Bootstrap multi-workspace a partir de WorkspaceSourceBinding",
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
