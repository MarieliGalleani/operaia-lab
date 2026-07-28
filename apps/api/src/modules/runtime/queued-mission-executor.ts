import type { Mission } from "@operaia/database";
import type {
  DelegationOutcome,
  EmployeeResult,
} from "@operaia/employee-runtime";
import { buildStrategicPlan } from "@operaia/agents";
import type { MemoryStore } from "@operaia/memory";
import type { DigitalOffice } from "../employees/office-composition.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import { buildDomainSyncActions } from "../operations/mission-domain-sync.js";
import {
  buildMissionExecutionPlan,
  executeMissionPlan,
  type MissionExecutionStack,
} from "../operations/mission-execution.js";
import {
  loadMissionMemoryNotes,
  persistMissionMemory,
} from "../operations/mission-memory.js";
import {
  loadOrganizationalLearningNotes,
  recordMissionLearning,
} from "../organization/mission-learning.js";
import type {
  WorkspacePortfolioSnapshot,
} from "../organization/workspace-portfolio.js";
import type { EmployeeWorkerLogger } from "./employee-worker.js";
import type { MissionQueue } from "./mission-queue.js";
import {
  asJson,
  type CoordinatePhaseResult,
  type ConsolidatePhaseResult,
  type ExecutePhaseResult,
  serializeEmployeeResult,
  toEmployeeResult,
} from "./mission-result-store.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";

type WorkspaceSnapshot = NonNullable<
  Awaited<ReturnType<WorkspaceSource["toSnapshot"]>>
>;

interface MissionContext {
  readonly workspace: WorkspaceSnapshot;
  readonly objective: string;
  readonly memoryNotes: readonly string[];
}

export type PortfolioProvider = () => Promise<WorkspacePortfolioSnapshot | null>;

/**
 * Executa missoes da fila sem delegacao sincrona.
 * Injeta Portfolio / Capacity / Learning no contexto da Opera.
 */
export class QueuedMissionExecutor {
  private portfolioProvider: PortfolioProvider | null = null;

  constructor(
    private readonly office: DigitalOffice,
    private readonly workspaces: WorkspaceSource,
    private readonly queue: MissionQueue,
    private readonly execution: MissionExecutionStack,
    private readonly memory: MemoryStore,
    private readonly logger: EmployeeWorkerLogger,
  ) {}

  setPortfolioProvider(provider: PortfolioProvider): void {
    this.portfolioProvider = provider;
  }

  async execute(mission: Mission, workerEmployeeId: string): Promise<void> {
    const snapshot = await this.workspaces.toSnapshot(mission.workspaceId);
    if (!snapshot) {
      throw new Error(`Workspace nao encontrado: ${mission.workspaceId}`);
    }

    const [memoryNotes, learningNotes, portfolio] = await Promise.all([
      loadMissionMemoryNotes(this.memory, {
        workspaceId: mission.workspaceId,
        objective: mission.objective,
      }),
      loadOrganizationalLearningNotes(mission.workspaceId),
      this.portfolioProvider?.() ?? Promise.resolve(null),
    ]);

    const contextNotes = [
      ...memoryNotes,
      ...learningNotes,
      ...(portfolio?.memoryNotes ?? []),
    ];

    const context: MissionContext = {
      workspace: snapshot,
      objective: mission.objective,
      memoryNotes: contextNotes,
    };

    switch (mission.missionKind) {
      case MissionKind.COORDINATE:
        await this.runCoordinate(mission, context, workerEmployeeId);
        return;
      case MissionKind.EXECUTE:
        await this.runExecute(mission, context, workerEmployeeId);
        return;
      case MissionKind.CONSOLIDATE:
        await this.runConsolidate(mission, context, workerEmployeeId);
        return;
      default:
        throw new Error(`missionKind desconhecido: ${mission.missionKind}`);
    }
  }

  private async runCoordinate(
    mission: Mission,
    context: MissionContext,
    workerEmployeeId: string,
  ): Promise<void> {
    const { registry, runner, matcher, llm } = this.office;
    const ceo = registry.require(CEO_EMPLOYEE_ID).create({ llm });
    const initial = await runner.run(ceo, {
      workspace: context.workspace,
      objective: context.objective,
      memoryNotes: context.memoryNotes,
    });

    const delegations = initial.output.decision.delegations;
    this.logger.info(
      {
        component: "queued-mission-executor",
        event: "coordinate_decided",
        missionId: mission.id,
        workerEmployeeId,
        delegationCount: delegations.length,
      },
      "Opera coordenou missao",
    );

    if (delegations.length === 0) {
      await this.finishWithoutDelegation(mission, initial, context);
      return;
    }

    const pendingTitles = context.workspace.tasks
      .filter((task) => task.status !== "DONE")
      .map((task) => task.title);
    const strategic = buildStrategicPlan({
      objective: context.objective,
      pendingTitles,
    });

    const childBySpec = new Map<string, string>();

    for (const request of delegations) {
      const matched = matcher.match(request.specialization);
      const objective = request.task ?? request.reason ?? context.objective;
      const hasIncoming = strategic.edges.some(
        (edge) => edge.toSpecialization === request.specialization,
      );
      const { mission: child } = await this.queue.enqueue({
        workspaceId: mission.workspaceId,
        projectId: mission.projectId ?? undefined,
        objective,
        parentMissionId: mission.id,
        missionKind: MissionKind.EXECUTE,
        requiredSpecialization: request.specialization,
        ownerEmployeeId: matched?.profile.id ?? "unmatched",
        priority: mission.priority,
        readiness: hasIncoming ? "BLOCKED" : "READY",
        dedupe: false,
      });
      childBySpec.set(request.specialization, child.id);
      this.logger.info(
        {
          component: "queued-mission-executor",
          event: "delegation_enqueued",
          parentMissionId: mission.id,
          childMissionId: child.id,
          specialization: request.specialization,
          matchedEmployeeId: matched?.profile.id,
          readiness: hasIncoming ? "BLOCKED" : "READY",
        },
        "Delegacao persistida na fila",
      );
    }

    for (const edge of strategic.edges) {
      const fromId = childBySpec.get(edge.fromSpecialization);
      const toId = childBySpec.get(edge.toSpecialization);
      if (fromId && toId) {
        await this.queue.linkDependency(toId, fromId);
      }
    }

    const partial: CoordinatePhaseResult = {
      phase: "coordinated",
      initial: serializeEmployeeResult(initial),
    };
    await this.queue.markWaiting(mission.id, asJson(partial));
  }

  private async finishWithoutDelegation(
    mission: Mission,
    initial: EmployeeResult,
    context: MissionContext,
  ): Promise<void> {
    const started = mission.startedAt?.getTime() ?? Date.now();
    const extraActions = buildDomainSyncActions({
      outcomes: [],
      workspaceTasks: context.workspace.tasks,
    });
    const executionPlan = buildMissionExecutionPlan({
      workspaceId: context.workspace.workspaceId,
      objective: context.objective,
      extraActions,
    });
    await executeMissionPlan(this.execution, executionPlan);

    const result: ConsolidatePhaseResult = {
      phase: "consolidated",
      usableResult: initial.output.report.summary,
      final: serializeEmployeeResult(initial),
      timing: {
        ceoMs: 0,
        specialistMs: 0,
        consolidationMs: 0,
        totalMs: Date.now() - started,
      },
    };

    await this.queue.complete(mission.id, asJson(result));
    await persistMissionMemory(this.memory, {
      workspaceId: mission.workspaceId,
      missionId: mission.id,
      objective: context.objective,
      summary: result.usableResult,
    });
    await recordMissionLearning(this.memory, {
      missionId: mission.id,
      workspaceId: mission.workspaceId,
      projectId: mission.projectId,
      objective: context.objective,
      decision: initial.output.decision.decision,
      justification: initial.output.decision.reasoning,
      result: result.usableResult,
      lessonsLearned: "Resposta direta da Opera sem delegacao.",
      reuseWhen: "Consultas executivas sem pendencia tecnica.",
      avoidWhen: "Objetivos que exigem multiplos dominios.",
      durationMs: Date.now() - started,
    });
  }

  private async runExecute(
    mission: Mission,
    context: MissionContext,
    workerEmployeeId: string,
  ): Promise<void> {
    const started = Date.now();
    const { registry, runner, llm } = this.office;
    const employee = registry.require(workerEmployeeId).create({ llm });
    const result = await runner.run(employee, {
      workspace: context.workspace,
      objective: context.objective,
      memoryNotes: context.memoryNotes,
    });

    const stored: ExecutePhaseResult = {
      phase: "executed",
      employeeResult: serializeEmployeeResult(result),
    };
    await this.queue.complete(mission.id, asJson(stored));

    await recordMissionLearning(this.memory, {
      missionId: mission.id,
      workspaceId: mission.workspaceId,
      projectId: mission.projectId,
      objective: context.objective,
      decision: result.output.decision.decision,
      justification: result.output.decision.reasoning,
      result: result.output.report.summary,
      risksFound: result.output.report.risks,
      lessonsLearned: `Execucao ${mission.requiredSpecialization ?? workerEmployeeId} concluida.`,
      reuseWhen: `Demandas de ${mission.requiredSpecialization}`,
      durationMs: Date.now() - started,
    });

    this.logger.info(
      {
        component: "queued-mission-executor",
        event: "specialist_executed",
        missionId: mission.id,
        workerEmployeeId,
        specialization: mission.requiredSpecialization,
        parentMissionId: mission.parentMissionId,
      },
      "Especialista concluiu missao",
    );

    if (mission.parentMissionId) {
      await this.queue.maybeEnqueueConsolidation(mission.parentMissionId);
    }
  }

  private async runConsolidate(
    mission: Mission,
    context: MissionContext,
    workerEmployeeId: string,
  ): Promise<void> {
    const rootMissionId = mission.parentMissionId;
    if (!rootMissionId) {
      throw new Error("CONSOLIDATE sem parentMissionId (raiz)");
    }

    const root = await this.queue.get(rootMissionId);
    if (!root?.resultJson) {
      throw new Error(`Raiz ${rootMissionId} sem resultado parcial`);
    }

    const children = await this.queue.listChildren(rootMissionId);
    const outcomes = this.buildOutcomesFromChildren(children);

    const specialistMs = children.reduce((acc, child) => {
      if (!child.startedAt || !child.finishedAt) {
        return acc;
      }
      return acc + (child.finishedAt.getTime() - child.startedAt.getTime());
    }, 0);

    const { registry, runner, llm } = this.office;
    const ceo = registry.require(CEO_EMPLOYEE_ID).create({ llm });

    const consolidationStart = Date.now();
    const final = await runner.run(ceo, {
      workspace: context.workspace,
      objective: root.objective,
      memoryNotes: context.memoryNotes,
      delegationOutcomes: outcomes,
    });
    const consolidationMs = Date.now() - consolidationStart;

    const extraActions = buildDomainSyncActions({
      outcomes,
      workspaceTasks: context.workspace.tasks,
    });
    const executionPlan = buildMissionExecutionPlan({
      workspaceId: context.workspace.workspaceId,
      objective: root.objective,
      extraActions,
    });
    await executeMissionPlan(this.execution, executionPlan);

    const result: ConsolidatePhaseResult = {
      phase: "consolidated",
      usableResult: final.output.report.summary,
      final: serializeEmployeeResult(final),
      timing: {
        ceoMs: 0,
        specialistMs,
        consolidationMs,
        totalMs: specialistMs + consolidationMs,
      },
    };

    await this.queue.completeConsolidation(
      mission.id,
      rootMissionId,
      asJson(result),
    );

    await persistMissionMemory(this.memory, {
      workspaceId: mission.workspaceId,
      missionId: rootMissionId,
      objective: root.objective,
      summary: result.usableResult,
    });

    await recordMissionLearning(this.memory, {
      missionId: rootMissionId,
      workspaceId: mission.workspaceId,
      projectId: mission.projectId,
      objective: root.objective,
      decision: final.output.decision.decision,
      justification: final.output.decision.reasoning,
      result: result.usableResult,
      impact: `${outcomes.filter((o) => o.matched).length} especialistas`,
      risksFound: final.output.decision.risks,
      lessonsLearned:
        "Consolidacao multi-especialista via Mission Queue assincrona.",
      reuseWhen: "Objetivos multi-dominio com delegacao paralela/sequencial.",
      avoidWhen: "Consultas simples sem necessidade de especialistas.",
      durationMs: specialistMs + consolidationMs,
      metrics: { specialistCount: outcomes.length, consolidationMs },
    });

    this.logger.info(
      {
        component: "queued-mission-executor",
        event: "consolidated",
        missionId: mission.id,
        rootMissionId,
        workerEmployeeId,
        specialistCount: outcomes.filter((o) => o.matched).length,
      },
      "Opera consolidou missao distribuida",
    );
  }

  private buildOutcomesFromChildren(
    children: readonly Mission[],
  ): DelegationOutcome[] {
    return children
      .filter((child) => child.missionKind === MissionKind.EXECUTE)
      .map((child) => {
        const stored = child.resultJson as ExecutePhaseResult | null;
        const request = {
          specialization: child.requiredSpecialization!,
          reason: child.objective,
          task: child.objective,
        };
        if (child.status !== "COMPLETED" || !stored?.employeeResult) {
          return { request, matched: false };
        }
        const briefing = {
          project: "",
          objective: child.objective,
          tasks: [],
          history: [],
          constraints: [],
          additional: {},
        };
        return {
          request,
          matched: true,
          employeeId: child.ownerEmployeeId,
          result: toEmployeeResult(stored.employeeResult, briefing),
        };
      });
  }
}
