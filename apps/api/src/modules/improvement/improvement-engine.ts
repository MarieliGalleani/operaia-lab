/**
 * Improvement Engine — apenas observa e gera Insights.
 * Nao modifica codigo, banco estrutural, deploy ou arquitetura.
 */

export type InsightSeverity = "info" | "warning" | "critical";

export interface ImprovementInsight {
  readonly code: string;
  readonly observer: string;
  readonly severity: InsightSeverity;
  readonly title: string;
  readonly evidence: string;
  readonly suggestedObjective: string;
  readonly targetProjectId: string | null;
  readonly isTeamEvolution: boolean;
  readonly detectedAt: string;
}

export interface ObserverContext {
  readonly portfolio: {
    readonly activeProjects: readonly {
      readonly projectId: string;
      readonly name: string;
      readonly pendingTasks: number;
      readonly blockedTasks: number;
      readonly openMissions: number;
      readonly staleTaskDays: number | null;
      readonly priority: string;
    }[];
    readonly capacity: {
      readonly workersAvailable: number;
      readonly workersBusy: number;
      readonly missionsQueued: number;
      readonly missionsRunning: number;
      readonly missionsWaiting: number;
      readonly saturatedSpecializations: readonly string[];
      readonly remainingCapacity: number;
    };
    readonly health: {
      readonly delayedProjects: readonly string[];
      readonly stalledProjects: readonly string[];
      readonly attentionRequired: readonly string[];
      readonly bottleneckSpecializations: readonly string[];
      readonly recurrentFailures: readonly string[];
    };
    readonly goals: readonly { readonly id: string; readonly title: string }[];
  };
  readonly queueDepths: {
    readonly queued: number;
    readonly running: number;
    readonly waiting: number;
    readonly failed: number;
  };
  readonly learningCount: number;
  readonly pendingApprovals: number;
  readonly evolutionProjectId: string | null;
}

export interface ImprovementObserver {
  readonly name: string;
  observe(ctx: ObserverContext): Promise<readonly ImprovementInsight[]> | readonly ImprovementInsight[];
}

export class ImprovementEngine {
  private readonly observers: ImprovementObserver[] = [];
  private lastInsights: ImprovementInsight[] = [];

  register(observer: ImprovementObserver): this {
    this.observers.push(observer);
    return this;
  }

  getObservers(): readonly string[] {
    return this.observers.map((o) => o.name);
  }

  getLastInsights(): readonly ImprovementInsight[] {
    return this.lastInsights;
  }

  async analyze(ctx: ObserverContext): Promise<readonly ImprovementInsight[]> {
    const insights: ImprovementInsight[] = [];
    for (const observer of this.observers) {
      const batch = await observer.observe(ctx);
      insights.push(...batch);
    }
    this.lastInsights = insights;
    return insights;
  }
}

function insight(
  partial: Omit<ImprovementInsight, "detectedAt">,
): ImprovementInsight {
  return { ...partial, detectedAt: new Date().toISOString() };
}

export function createRuntimeObserver(): ImprovementObserver {
  return {
    name: "RuntimeObserver",
    observe(ctx) {
      const out: ImprovementInsight[] = [];
      if (ctx.queueDepths.failed > 0) {
        out.push(
          insight({
            code: "RUNTIME_FAILED_MISSIONS",
            observer: "RuntimeObserver",
            severity: "warning",
            title: "Missoes FAILED na fila",
            evidence: `failed=${ctx.queueDepths.failed}`,
            suggestedObjective:
              "Analisar falhas recorrentes na Mission Queue e propor recuperacao",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      if (ctx.queueDepths.queued > 20) {
        out.push(
          insight({
            code: "RUNTIME_QUEUE_CONGESTION",
            observer: "RuntimeObserver",
            severity: "critical",
            title: "Fila congestionada",
            evidence: `queued=${ctx.queueDepths.queued}`,
            suggestedObjective:
              "Avaliar capacidade operacional e gargalos da Mission Queue",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      if (ctx.portfolio.capacity.workersAvailable > 5) {
        out.push(
          insight({
            code: "RUNTIME_IDLE_WORKERS",
            observer: "RuntimeObserver",
            severity: "info",
            title: "Workers ociosos",
            evidence: `available=${ctx.portfolio.capacity.workersAvailable}`,
            suggestedObjective:
              "Distribuir trabalho pendente do Workspace aos Workers ociosos",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      return out;
    },
  };
}

export function createProjectObserver(): ImprovementObserver {
  return {
    name: "ProjectObserver",
    observe(ctx) {
      const out: ImprovementInsight[] = [];
      for (const project of ctx.portfolio.activeProjects) {
        if (project.blockedTasks > 0) {
          out.push(
            insight({
              code: "PROJECT_BLOCKED_TASKS",
              observer: "ProjectObserver",
              severity: "warning",
              title: `Bloqueios em ${project.name}`,
              evidence: `blocked=${project.blockedTasks}`,
              suggestedObjective: `Desbloquear tarefas bloqueadas do projeto ${project.name}`,
              targetProjectId: project.projectId,
              isTeamEvolution: false,
            }),
          );
        }
        if (project.staleTaskDays && project.staleTaskDays >= 7) {
          out.push(
            insight({
              code: "PROJECT_STALE_TASKS",
              observer: "ProjectObserver",
              severity: "warning",
              title: `Tarefas antigas em ${project.name}`,
              evidence: `staleDays=${project.staleTaskDays}`,
              suggestedObjective: `Revisar tarefas antigas do projeto ${project.name}`,
              targetProjectId: project.projectId,
              isTeamEvolution: false,
            }),
          );
        }
        if (project.pendingTasks > 0 && project.openMissions === 0) {
          out.push(
            insight({
              code: "PROJECT_UNMONITORED",
              observer: "ProjectObserver",
              severity: "info",
              title: `${project.name} sem missao ativa`,
              evidence: `pending=${project.pendingTasks}`,
              suggestedObjective: `Acompanhar pendencias do projeto ${project.name}`,
              targetProjectId: project.projectId,
              isTeamEvolution: false,
            }),
          );
        }
      }
      return out;
    },
  };
}

export function createPortfolioObserver(): ImprovementObserver {
  return {
    name: "PortfolioObserver",
    observe(ctx) {
      const out: ImprovementInsight[] = [];
      if (ctx.portfolio.health.attentionRequired.length > 0) {
        out.push(
          insight({
            code: "PORTFOLIO_ATTENTION",
            observer: "PortfolioObserver",
            severity: "critical",
            title: "Projetos exigem atencao imediata",
            evidence: ctx.portfolio.health.attentionRequired.join(", "),
            suggestedObjective: `Priorizar projetos em risco: ${ctx.portfolio.health.attentionRequired.join(", ")}`,
            targetProjectId: null,
            isTeamEvolution: false,
          }),
        );
      }
      if (ctx.portfolio.activeProjects.length === 0) {
        out.push(
          insight({
            code: "PORTFOLIO_NO_ACTIVE",
            observer: "PortfolioObserver",
            severity: "warning",
            title: "Nenhum projeto ACTIVE",
            evidence: "activeProjects=0",
            suggestedObjective:
              "Revisar status dos projetos do Workspace e ativar prioridades",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      return out;
    },
  };
}

export function createInfrastructureObserver(): ImprovementObserver {
  return {
    name: "InfrastructureObserver",
    observe(ctx) {
      const out: ImprovementInsight[] = [];
      if (ctx.portfolio.capacity.saturatedSpecializations.length > 0) {
        out.push(
          insight({
            code: "INFRA_SATURATED_SPEC",
            observer: "InfrastructureObserver",
            severity: "warning",
            title: "Especializacoes saturadas",
            evidence: ctx.portfolio.capacity.saturatedSpecializations.join(", "),
            suggestedObjective:
              "Avaliar capacidade e sequenciamento das especializacoes saturadas",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      if (ctx.portfolio.capacity.missionsWaiting > 10) {
        out.push(
          insight({
            code: "INFRA_WAITING_BACKLOG",
            observer: "InfrastructureObserver",
            severity: "warning",
            title: "Muitas missoes WAITING",
            evidence: `waiting=${ctx.portfolio.capacity.missionsWaiting}`,
            suggestedObjective:
              "Investigar missoes WAITING e dependencias DAG pendentes",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      return out;
    },
  };
}

export function createKnowledgeObserver(): ImprovementObserver {
  return {
    name: "KnowledgeObserver",
    observe(ctx) {
      const out: ImprovementInsight[] = [];
      if (ctx.learningCount === 0) {
        out.push(
          insight({
            code: "KNOWLEDGE_NO_LEARNING",
            observer: "KnowledgeObserver",
            severity: "info",
            title: "Memoria organizacional vazia",
            evidence: "learningCount=0",
            suggestedObjective:
              "Garantir registro de Mission Learning apos consolidacoes",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      return out;
    },
  };
}

export function createQualityObserver(): ImprovementObserver {
  return {
    name: "QualityObserver",
    observe(ctx) {
      const out: ImprovementInsight[] = [];
      if (ctx.portfolio.health.recurrentFailures.length > 0) {
        out.push(
          insight({
            code: "QUALITY_RECURRENT_FAILURES",
            observer: "QualityObserver",
            severity: "critical",
            title: "Falhas recorrentes detectadas",
            evidence: ctx.portfolio.health.recurrentFailures.slice(0, 3).join(" | "),
            suggestedObjective:
              "Analisar causa raiz das falhas recorrentes e propor melhoria",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      if (ctx.pendingApprovals > 5) {
        out.push(
          insight({
            code: "QUALITY_APPROVAL_BACKLOG",
            observer: "QualityObserver",
            severity: "warning",
            title: "Backlog de aprovacoes humanas",
            evidence: `pendingApprovals=${ctx.pendingApprovals}`,
            suggestedObjective:
              "Revisar propostas WAITING_APPROVAL com o humano responsavel",
            targetProjectId: ctx.evolutionProjectId,
            isTeamEvolution: true,
          }),
        );
      }
      return out;
    },
  };
}

export function createDefaultImprovementEngine(): ImprovementEngine {
  return new ImprovementEngine()
    .register(createRuntimeObserver())
    .register(createProjectObserver())
    .register(createPortfolioObserver())
    .register(createInfrastructureObserver())
    .register(createKnowledgeObserver())
    .register(createQualityObserver());
}
