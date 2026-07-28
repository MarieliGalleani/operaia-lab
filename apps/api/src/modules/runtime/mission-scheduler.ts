import type {
  ImprovementEngine,
  ImprovementInsight,
} from "../improvement/improvement-engine.js";
import type { GovernanceService } from "../governance/governance-service.js";
import {
  buildWorkspacePortfolioSnapshot,
  pickPortfolioAnchorProject,
  type WorkspacePortfolioSnapshot,
} from "../organization/workspace-portfolio.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import type { ProjectRepository } from "../projects/domain/project.repository.js";
import type { TaskRepository } from "../tasks/domain/task.repository.js";
import type { EmployeeWorkerLogger } from "./employee-worker.js";
import type { MissionQueue } from "./mission-queue.js";
import { CEO_EMPLOYEE_ID } from "./mission-states.js";
import type { LearningStatsPort, ScheduleRulePort } from "./supervisor/ports.js";

export interface MissionSchedulerOptions {
  readonly queue: MissionQueue;
  readonly workspaces: WorkspaceSource;
  readonly projects: ProjectRepository;
  readonly tasks: TaskRepository;
  readonly intervalMs: number;
  readonly logger: EmployeeWorkerLogger;
  readonly improvement: ImprovementEngine;
  readonly governance: GovernanceService;
  readonly learningStats: LearningStatsPort;
  readonly scheduleRules: ScheduleRulePort;
  readonly onInsights?: (insights: readonly ImprovementInsight[]) => void;
}

export interface CoordinationCycleResult {
  readonly enqueued: number;
  readonly details: readonly string[];
}

/**
 * MissionScheduler — ciclo de portfolio/planning sob demanda da Opera.
 * Nao e invocado pelo Operational Supervisor.
 * Sem timer proprio no ContinuousRuntime v2.
 */
export class MissionScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private lastTickAt: string | null = null;
  private lastEnqueued = 0;
  private startedAt: number | null = null;
  private lastSnapshot: WorkspacePortfolioSnapshot | null = null;

  constructor(private readonly options: MissionSchedulerOptions) {}

  /** @deprecated Prefer Operational Supervisor v2 loop; mantido para compat. */
  start(): void {
    if (this.timer) {
      return;
    }
    this.startedAt = Date.now();
    this.options.logger.info(
      { component: "mission-scheduler", event: "started" },
      "Scheduler iniciado",
    );
    void this.runCycle();
    this.timer = setInterval(
      () => void this.runCycle(),
      this.options.intervalMs,
    );
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    while (this.ticking) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.options.logger.info(
      { component: "mission-scheduler", event: "stopped" },
      "Scheduler parado",
    );
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }

  snapshot(): {
    readonly lastTickAt: string | null;
    readonly lastEnqueued: number;
    readonly uptimeMs: number;
    readonly running: boolean;
  } {
    return {
      lastTickAt: this.lastTickAt,
      lastEnqueued: this.lastEnqueued,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      running: this.timer !== null,
    };
  }

  /** Ciclo de coordenacao — usado pelo Operational Supervisor (Dispatch). */
  async runCycle(): Promise<CoordinationCycleResult> {
    if (this.ticking) {
      return { enqueued: 0, details: ["cycle already running"] };
    }
    this.ticking = true;
    let enqueued = 0;
    const details: string[] = [];

    try {
      const portfolio = await buildWorkspacePortfolioSnapshot({
        projects: this.options.projects,
        tasks: this.options.tasks,
        queue: this.options.queue,
      });
      this.lastSnapshot = portfolio;

      const evolutionProject =
        portfolio.activeProjects.find((p) =>
          p.name.toLowerCase().includes("operaia"),
        ) ?? null;

      const [learningCount, pendingApprovals, depths] = await Promise.all([
        this.options.learningStats.count(),
        this.options.governance.countPending(),
        this.options.queue.depths(),
      ]);

      const insights = await this.options.improvement.analyze({
        portfolio,
        queueDepths: depths,
        learningCount,
        pendingApprovals,
        evolutionProjectId: evolutionProject?.projectId ?? null,
      });
      this.options.onInsights?.(insights);

      this.options.logger.info(
        {
          component: "mission-scheduler",
          event: "cycle",
          activeProjects: portfolio.activeProjects.length,
          insights: insights.length,
          observers: this.options.improvement.getObservers(),
          capacity: portfolio.capacity,
          attention: portfolio.health.attentionRequired,
        },
        "Ciclo Snapshot → Health → Improvement Engine",
      );

      const throttled =
        portfolio.capacity.remainingCapacity === 0 &&
        portfolio.capacity.missionsQueued + portfolio.capacity.missionsRunning >
          5;

      if (throttled) {
        details.push("capacity_throttle");
        this.options.logger.info(
          {
            component: "mission-scheduler",
            event: "capacity_throttle",
            capacity: portfolio.capacity,
          },
          "Capacidade saturada — adiando novo COORDINATE",
        );
      } else {
        const allNames = portfolio.activeProjects.map((p) => p.name);
        const anchor = pickPortfolioAnchorProject(portfolio);
        if (anchor && allNames.length > 0) {
          const workspaces = await this.options.workspaces.listWorkspaces();
          const workspace =
            workspaces.find(
              (item) =>
                item.id === anchor.projectId ||
                item.name.toLowerCase() === anchor.name.toLowerCase(),
            ) ?? workspaces.find((item) => item.id.includes(anchor.projectId));

          const workspaceId = workspace?.id ?? anchor.projectId;
          const insightLine = insights
            .slice(0, 5)
            .map((i) => i.title)
            .join("; ");

          const objective =
            `Priorizar Workspace (${allNames.join(", ")}). ` +
            `Ancora: ${anchor.name}. ` +
            `Insights: ${insightLine || "acompanhamento continuo"}`;

          const { created } = await this.options.queue.enqueue({
            workspaceId,
            projectId: anchor.projectId,
            objective,
            ownerEmployeeId: CEO_EMPLOYEE_ID,
            priority: mapPriority(anchor.priority),
            dedupe: true,
          });
          if (created) {
            enqueued += 1;
            details.push(`coordinate:${anchor.name}`);
          }
        }

        for (const project of portfolio.activeProjects) {
          if (project.openMissions > 0 || project.pendingTasks === 0) {
            continue;
          }
          if (project.projectId === anchor?.projectId) {
            continue;
          }
          const workspaces = await this.options.workspaces.listWorkspaces();
          const workspace =
            workspaces.find(
              (item) =>
                item.id === project.projectId ||
                item.name.toLowerCase() === project.name.toLowerCase(),
            ) ?? undefined;
          const { created } = await this.options.queue.enqueue({
            workspaceId: workspace?.id ?? project.projectId,
            projectId: project.projectId,
            objective: `Acompanhar projeto ACTIVE sem missao: ${project.name} (${project.pendingTasks} pendencias)`,
            ownerEmployeeId: CEO_EMPLOYEE_ID,
            priority: mapPriority(project.priority),
            dedupe: true,
          });
          if (created) {
            enqueued += 1;
            details.push(`active-without-mission:${project.name}`);
          }
        }
      }

      const rules = await this.options.scheduleRules.listEnabled();
      const now = Date.now();
      for (const rule of rules) {
        const due =
          !rule.lastEnqueuedAt ||
          now - rule.lastEnqueuedAt.getTime() >= rule.intervalSec * 1000;
        if (!due || !rule.workspaceId) {
          continue;
        }
        const objective =
          rule.objective ??
          `Verificacao recorrente do workspace ${rule.workspaceId}`;
        const { created } = await this.options.queue.enqueue({
          workspaceId: rule.workspaceId,
          objective,
          ownerEmployeeId: CEO_EMPLOYEE_ID,
          dedupe: true,
        });
        await this.options.scheduleRules.markEnqueued(rule.id, new Date());
        if (created) {
          enqueued += 1;
          details.push(`schedule-rule:${rule.id}`);
        }
      }

      this.lastEnqueued = enqueued;
      this.lastTickAt = new Date().toISOString();
      if (!this.startedAt) {
        this.startedAt = Date.now();
      }
      this.options.logger.info(
        {
          component: "mission-scheduler",
          event: "tick",
          enqueued,
          activeProjects: portfolio.activeProjects.length,
          insights: insights.length,
        },
        "Ciclo do scheduler",
      );
      return { enqueued, details };
    } catch (error) {
      this.options.logger.error(
        {
          component: "mission-scheduler",
          event: "tick_error",
          error: error instanceof Error ? error.message : String(error),
        },
        "Falha no scheduler",
      );
      return {
        enqueued,
        details: [
          `error:${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    } finally {
      this.ticking = false;
    }
  }
}

function mapPriority(
  priority: string,
): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  if (
    priority === "LOW" ||
    priority === "MEDIUM" ||
    priority === "HIGH" ||
    priority === "URGENT"
  ) {
    return priority;
  }
  return "MEDIUM";
}
