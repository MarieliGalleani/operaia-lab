import type { Mission } from "@operaia/database";
import {
  buildToolsForEmployee,
  type DelegationOutcome,
  type EmployeeActionsFactory,
  type EmployeeResult,
  type EmployeeToolsFactory,
} from "@operaia/employee-runtime";
import { BriefingBuilder, Specialization } from "@operaia/employee-framework";
import { inferDefaultEdges } from "@operaia/agents";
import type { MemoryStore } from "@operaia/memory";
import {
  defaultFailurePolicy,
  NonCriticalOperation,
} from "@operaia/operational-health";
import type { DigitalOffice } from "../employees/office-composition.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import { buildDomainSyncActions } from "../operations/mission-domain-sync.js";
import {
  buildMissionExecutionPlan,
  executeMissionPlan,
  type MissionExecutionStack,
} from "../operations/mission-execution.js";
import {
  loadOperationalMemoryNotes,
  persistMissionMemory,
} from "../operations/mission-memory.js";
import {
  loadOrganizationalLearningNotesFromPrisma,
  recordMissionLearning,
} from "../organization/mission-learning.js";
import type {
  WorkspacePortfolioSnapshot,
} from "../organization/workspace-portfolio.js";
import type { EmployeeWorkerLogger } from "./employee-worker.js";
import { buildExecutionReport } from "./execution-report.js";
import type { MissionQueue } from "./mission-queue.js";
import { hashObjective } from "./mission-queue.js";
import {
  asJson,
  type CoordinatePhaseResult,
  type ConsolidatePhaseResult,
  type ExecutePhaseResult,
  readCoordinatePhaseResult,
  serializeEmployeeResult,
  toEmployeeResult,
} from "./mission-result-store.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";

/** MissionEvent type para invocacao real de tool (F4 vertical slice). */
export const TOOL_USED_MISSION_EVENT_TYPE = "tool_used";
/** MissionEvent type para entrega estruturada verificavel (F4 job→delivery). */
export const DELIVERY_CREATED_MISSION_EVENT_TYPE = "delivery_created";
/** MissionEvent: follow-up COORDINATE ja enfileirado a partir desta EXECUTE (idempotencia). */
export const FOLLOW_UP_ENQUEUED_MISSION_EVENT_TYPE = "follow_up_enqueued";
/** Marker F6 — CEO so delega follow-up com este token + SOURCE_EXECUTE. */
export const FOLLOW_UP_DELEGATE_MARKER = "[FOLLOW_UP_DELEGATE]";

type FollowUpDelivery = NonNullable<ExecutePhaseResult["delivery"]>;

/**
 * Objective estavel (hash/dedupe) — contexto rico vem via resolvePreviousDelivery.
 */
export function buildTechnicalFollowUpObjective(
  sourceExecuteMissionId: string,
): string {
  return (
    `[SOURCE_EXECUTE:${sourceExecuteMissionId}] ${FOLLOW_UP_DELEGATE_MARKER} ` +
    "Continuar trabalho a partir da technical_analysis DELIVERED."
  );
}

/**
 * Gate puro do producer P0 — max 1 follow-up por fonte; sem cadeia B→C.
 */
export function shouldEnqueueTechnicalFollowUp(input: {
  readonly delivery: FollowUpDelivery | undefined;
  readonly parentCoordinateObjective?: string | null;
  readonly sourceAlreadyEmittedFollowUp: boolean;
  readonly followUpMissionAlreadyExists: boolean;
}): boolean {
  const delivery = input.delivery;
  if (!delivery) {
    return false;
  }
  if (delivery.status !== "DELIVERED") {
    return false;
  }
  if (delivery.type !== "technical_analysis") {
    return false;
  }
  if (!Array.isArray(delivery.evidence) || delivery.evidence.length === 0) {
    return false;
  }
  if (!Array.isArray(delivery.findings) || delivery.findings.length === 0) {
    return false;
  }
  const parentObjective = input.parentCoordinateObjective ?? "";
  if (parentObjective.includes(FOLLOW_UP_DELEGATE_MARKER)) {
    return false;
  }
  if (parentObjective.includes("GENERAL_CONVERSATION")) {
    return false;
  }
  if (input.sourceAlreadyEmittedFollowUp) {
    return false;
  }
  if (input.followUpMissionAlreadyExists) {
    return false;
  }
  return true;
}

/**
 * P0 — apos technical_analysis DELIVERED, enfileira 1 COORDINATE F5+F6.
 * Usado pelo QueuedMissionExecutor (runtime real) e testes de integracao.
 */
export async function enqueueTechnicalFollowUpIfEligible(input: {
  readonly queue: MissionQueue;
  readonly logger: EmployeeWorkerLogger;
  readonly source: Mission;
  readonly delivery: ExecutePhaseResult["delivery"] | undefined;
}): Promise<{ readonly followUpMissionId: string; readonly created: boolean } | null> {
  const { queue, logger, source, delivery } = input;
  const objective = buildTechnicalFollowUpObjective(source.id);
  const objectiveHash = hashObjective(source.workspaceId, objective);

  let parentCoordinateObjective: string | null = null;
  if (source.parentMissionId) {
    const parent = await queue.get(source.parentMissionId);
    parentCoordinateObjective = parent?.objective ?? null;
  }

  const sourceAlreadyEmittedFollowUp = await queue.hasEvent(
    source.id,
    FOLLOW_UP_ENQUEUED_MISSION_EVENT_TYPE,
  );
  const existing = await queue.findByObjectiveHash(
    source.workspaceId,
    objectiveHash,
  );

  if (
    !shouldEnqueueTechnicalFollowUp({
      delivery,
      parentCoordinateObjective,
      sourceAlreadyEmittedFollowUp,
      followUpMissionAlreadyExists: Boolean(existing),
    })
  ) {
    return null;
  }

  try {
    const { mission: followUp, created } = await queue.enqueue({
      workspaceId: source.workspaceId,
      projectId: source.projectId ?? undefined,
      objective,
      missionKind: MissionKind.COORDINATE,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: true,
    });

    await queue.appendEvent(
      source.id,
      FOLLOW_UP_ENQUEUED_MISSION_EVENT_TYPE,
      "Follow-up COORDINATE enfileirado a partir de technical_analysis",
      asJson({
        sourceMissionId: source.id,
        followUpMissionId: followUp.id,
        created,
        objectiveHash,
      }),
    );

    logger.info(
      {
        component: "queued-mission-executor",
        event: "follow_up_enqueued",
        sourceMissionId: source.id,
        followUpMissionId: followUp.id,
        workspaceId: source.workspaceId,
        created,
      },
      "Follow-up tecnico COORDINATE enfileirado",
    );

    return { followUpMissionId: followUp.id, created };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      {
        component: "queued-mission-executor",
        event: "follow_up_enqueue_failed",
        sourceMissionId: source.id,
        workspaceId: source.workspaceId,
        error: message,
      },
      "Falha ao enfileirar follow-up (EXECUTE permanece COMPLETED)",
    );
    return null;
  }
}

type WorkspaceSnapshot = NonNullable<
  Awaited<ReturnType<WorkspaceSource["toSnapshot"]>>
>;

interface MissionContext {
  readonly workspace: WorkspaceSnapshot;
  readonly objective: string;
  readonly memoryNotes: readonly string[];
  readonly previousDelivery?: {
    readonly sourceMissionId: string;
    readonly delivery: NonNullable<ExecutePhaseResult["delivery"]>;
  };
}

export type PortfolioProvider = () => Promise<WorkspacePortfolioSnapshot | null>;

export interface QueuedMissionExecutorOptions {
  /**
   * Fallback M1.4: se indice vazio, le MissionLearning.
   * So para migracao — default false.
   */
  readonly allowLearningPrismaFallback?: boolean;
  /**
   * Factory de ToolContext (GitHub ports + permission policy).
   * Default: tools sem adapters.
   */
  readonly toolsFactory?: EmployeeToolsFactory;
  /**
   * Factory de ActionCapabilityProvider (Action Runtime A.5).
   * Default: sem acoes.
   */
  readonly actionsFactory?: EmployeeActionsFactory;
}

/**
 * Executa missoes da fila sem delegacao sincrona.
 * Injeta Portfolio / Capacity / Learning no contexto da Opera.
 */
export class QueuedMissionExecutor {
  private portfolioProvider: PortfolioProvider | null = null;
  private readonly allowLearningPrismaFallback: boolean;
  private toolsFactory: EmployeeToolsFactory;
  private actionsFactory: EmployeeActionsFactory;

  constructor(
    private readonly office: DigitalOffice,
    private readonly workspaces: WorkspaceSource,
    private readonly queue: MissionQueue,
    private readonly execution: MissionExecutionStack,
    private readonly memory: MemoryStore,
    private readonly logger: EmployeeWorkerLogger,
    options: QueuedMissionExecutorOptions = {},
  ) {
    this.allowLearningPrismaFallback =
      options.allowLearningPrismaFallback ?? false;
    this.toolsFactory =
      options.toolsFactory ??
      ((employeeId, workspaceId) =>
        buildToolsForEmployee(employeeId, { workspaceId }));
    this.actionsFactory = options.actionsFactory ?? (() => null);
  }

  setPortfolioProvider(provider: PortfolioProvider): void {
    this.portfolioProvider = provider;
  }

  setToolsFactory(factory: EmployeeToolsFactory): void {
    this.toolsFactory = factory;
  }

  setActionsFactory(factory: EmployeeActionsFactory): void {
    this.actionsFactory = factory;
  }

  async execute(mission: Mission, workerEmployeeId: string): Promise<void> {
    const snapshot = await this.workspaces.toSnapshot(mission.workspaceId);
    if (!snapshot) {
      throw new Error(`Workspace nao encontrado: ${mission.workspaceId}`);
    }

    // M1.4 — um unico caminho MemoryStore (sem dual-read MissionLearning).
    const [memoryNotes, portfolio] = await Promise.all([
      loadOperationalMemoryNotes(this.memory, {
        workspaceId: mission.workspaceId,
        objective: mission.objective,
        allowLearningPrismaFallback: this.allowLearningPrismaFallback,
        learningPrismaFallback: this.allowLearningPrismaFallback
          ? loadOrganizationalLearningNotesFromPrisma
          : undefined,
      }),
      this.portfolioProvider?.() ?? Promise.resolve(null),
    ]);

    const contextNotes = [
      ...memoryNotes,
      ...(portfolio?.memoryNotes ?? []),
    ];

    const previousDelivery = await this.resolvePreviousDelivery(
      mission.objective,
    );

    const context: MissionContext = {
      workspace: snapshot,
      objective: mission.objective,
      memoryNotes: contextNotes,
      ...(previousDelivery ? { previousDelivery } : {}),
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
      ...(context.previousDelivery
        ? { previousDelivery: context.previousDelivery }
        : {}),
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
      await this.finishWithoutDelegation(
        mission,
        initial,
        context,
        workerEmployeeId,
      );
      return;
    }

    const specializations = delegations
      .map((request) => parseSpecialization(request.specialization))
      .filter((spec): spec is Specialization => Boolean(spec));
    // Edges a partir das delegacoes validadas pela Opera (nao recalcula dominio).
    const edges = inferDefaultEdges(specializations);

    const childBySpec = new Map<string, string>();

    for (const request of delegations) {
      const matched = matcher.match(request.specialization);
      const objective = request.task ?? request.reason ?? context.objective;
      const hasIncoming = edges.some(
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

    for (const edge of edges) {
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
    await this.queue.markWaiting(
      mission.id,
      asJson(partial),
      mission.leaseVersion,
    );
  }

  private async finishWithoutDelegation(
    mission: Mission,
    initial: EmployeeResult,
    context: MissionContext,
    workerEmployeeId: string,
  ): Promise<void> {
    const started = mission.startedAt?.getTime() ?? Date.now();
    const extraActions = buildDomainSyncActions({
      outcomes: [],
      workspaceTasks: context.workspace.tasks ?? [],
    });
    const executionPlan = buildMissionExecutionPlan({
      workspaceId: context.workspace.workspaceId,
      objective: context.objective,
      extraActions,
    });
    await executeMissionPlan(this.execution, executionPlan);

    const storedInitial = serializeEmployeeResult(initial);
    const rawDelivery = initial.output.decision.delivery;
    const delivery = rawDelivery
      ? {
          ...rawDelivery,
          missionId: mission.id,
          employeeId: workerEmployeeId,
        }
      : undefined;

    if (delivery?.status === "DELIVERED") {
      await this.queue.appendEvent(
        mission.id,
        DELIVERY_CREATED_MISSION_EVENT_TYPE,
        `Delivery ${delivery.type} DELIVERED`,
        asJson({
          missionId: mission.id,
          employeeId: workerEmployeeId,
          deliveryType: delivery.type,
          summary: delivery.summary,
          evidence: summarizeDeliveryEvidence(delivery.evidence),
          success: true,
          ...(delivery.sourceMissionId
            ? { sourceMissionId: delivery.sourceMissionId }
            : {}),
        }),
      );
    }

    const result: ConsolidatePhaseResult = {
      phase: "consolidated",
      initial: storedInitial,
      usableResult: initial.output.report.summary,
      final: storedInitial,
      timing: {
        ceoMs: 0,
        specialistMs: 0,
        consolidationMs: 0,
        totalMs: Date.now() - started,
      },
      ...(delivery ? { delivery } : {}),
    };

    await this.queue.complete(
      mission.id,
      asJson(result),
      mission.leaseVersion,
    );
    await this.safePersistMemorySideEffects({
      missionId: mission.id,
      workspaceId: mission.workspaceId,
      phase: "finishWithoutDelegation",
      run: async () => {
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
      },
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
    const tools = await this.toolsFactory(
      workerEmployeeId,
      mission.workspaceId,
    );
    const actions = await this.actionsFactory(
      workerEmployeeId,
      mission.workspaceId,
    );
    const result = await runner.run(employee, {
      workspace: context.workspace,
      objective: context.objective,
      memoryNotes: context.memoryNotes,
      tools,
      actions,
    });

    const executionTime = Date.now() - started;
    const executionReport = buildExecutionReport({
      employeeId: workerEmployeeId,
      summary: result.output.report.summary,
      analysis: result.output.report.analysis,
      risks: result.output.report.risks,
      recommendations: result.output.report.recommendations,
      findings: [result.output.decision.analyzed],
      qualityPassed: result.output.quality.passed,
      executionTime,
    });

    const toolExecutions = result.output.decision.toolExecutions ?? [];
    for (const execution of toolExecutions) {
      await this.queue.appendEvent(
        mission.id,
        TOOL_USED_MISSION_EVENT_TYPE,
        `Tool ${execution.toolId} ${execution.success ? "ok" : "failed"}`,
        asJson({
          missionId: mission.id,
          employeeId: workerEmployeeId,
          toolId: execution.toolId,
          success: execution.success,
          outcome: execution.outcome,
          at: execution.at,
        }),
      );
    }

    const rawDelivery = result.output.decision.delivery;
    const delivery = rawDelivery
      ? {
          ...rawDelivery,
          missionId: mission.id,
          employeeId: workerEmployeeId,
        }
      : undefined;

    if (delivery?.status === "DELIVERED") {
      await this.queue.appendEvent(
        mission.id,
        DELIVERY_CREATED_MISSION_EVENT_TYPE,
        `Delivery ${delivery.type} DELIVERED`,
        asJson({
          missionId: mission.id,
          employeeId: workerEmployeeId,
          deliveryType: delivery.type,
          summary: delivery.summary,
          evidence: summarizeDeliveryEvidence(delivery.evidence),
          success: true,
          ...(delivery.sourceMissionId
            ? { sourceMissionId: delivery.sourceMissionId }
            : {}),
        }),
      );
    }

    const stored: ExecutePhaseResult = {
      phase: "executed",
      employeeResult: serializeEmployeeResult(result),
      executionReport,
      ...(toolExecutions.length > 0 ? { toolExecutions } : {}),
      ...(delivery ? { delivery } : {}),
    };
    await this.queue.complete(
      mission.id,
      asJson(stored),
      mission.leaseVersion,
    );

    await this.safePersistMemorySideEffects({
      missionId: mission.id,
      workspaceId: mission.workspaceId,
      phase: "execute",
      run: async () => {
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
          durationMs: executionTime,
        });
      },
    });

    this.logger.info(
      {
        component: "queued-mission-executor",
        event: "specialist_executed",
        missionId: mission.id,
        workerEmployeeId,
        specialization: mission.requiredSpecialization,
        parentMissionId: mission.parentMissionId,
        confidence: executionReport.confidence,
      },
      "Especialista concluiu missao",
    );

    if (mission.parentMissionId) {
      await this.queue.maybeEnqueueConsolidation(mission.parentMissionId);
    }

    await enqueueTechnicalFollowUpIfEligible({
      queue: this.queue,
      logger: this.logger,
      source: mission,
      delivery,
    });
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
      workspaceTasks: context.workspace.tasks ?? [],
    });
    const executionPlan = buildMissionExecutionPlan({
      workspaceId: context.workspace.workspaceId,
      objective: root.objective,
      extraActions,
    });
    await executeMissionPlan(this.execution, executionPlan);

    const coordinated = readCoordinatePhaseResult(root.resultJson);

    const result: ConsolidatePhaseResult = {
      phase: "consolidated",
      ...(coordinated?.initial ? { initial: coordinated.initial } : {}),
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
      mission.leaseVersion,
    );

    await this.safePersistMemorySideEffects({
      missionId: mission.id,
      workspaceId: mission.workspaceId,
      rootMissionId,
      phase: "consolidate",
      run: async () => {
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
      },
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

  /**
   * Memoria/Learning sao NON_CRITICAL (FailurePolicy A.5.3).
   * Falha apos complete() nunca reverte missao SUCCESS → FAILED.
   */
  private async safePersistMemorySideEffects(input: {
    readonly missionId: string;
    readonly workspaceId: string;
    readonly phase: string;
    readonly rootMissionId?: string;
    readonly run: () => Promise<void>;
  }): Promise<void> {
    await defaultFailurePolicy.runNonCritical({
      operation: NonCriticalOperation.OPERATIONAL_MEMORY,
      workspaceId: input.workspaceId,
      correlationId: input.missionId,
      component: "queued-mission-executor",
      run: input.run,
      onFailure: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          {
            component: "queued-mission-executor",
            event: "memory_side_effect_failed",
            missionId: input.missionId,
            workspaceId: input.workspaceId,
            rootMissionId: input.rootMissionId ?? null,
            phase: input.phase,
            criticality: "NON_CRITICAL",
            error: message,
            stack,
          },
          "Falha NON_CRITICAL pos-missao (missao permanece concluida)",
        );
      },
    });
  }

  /**
   * F5 — marker minimo [SOURCE_EXECUTE:<id>] no objective.
   * Carrega delivery DELIVERED da Mission EXECUTE fonte.
   */
  private async resolvePreviousDelivery(
    objective: string,
  ): Promise<MissionContext["previousDelivery"] | undefined> {
    const match = /\[SOURCE_EXECUTE:([^\]]+)\]/.exec(objective);
    const sourceMissionId = match?.[1]?.trim();
    if (!sourceMissionId) {
      return undefined;
    }

    const source = await this.queue.get(sourceMissionId);
    if (!source) {
      this.logger.warn(
        {
          component: "queued-mission-executor",
          event: "source_execute_missing",
          sourceMissionId,
        },
        "SOURCE_EXECUTE nao encontrado",
      );
      return undefined;
    }

    const resultJson = source.resultJson as ExecutePhaseResult | null;
    const delivery = resultJson?.delivery;
    if (!delivery || delivery.status !== "DELIVERED") {
      this.logger.warn(
        {
          component: "queued-mission-executor",
          event: "source_execute_delivery_invalid",
          sourceMissionId,
          hasDelivery: Boolean(delivery),
          status: delivery?.status ?? null,
        },
        "SOURCE_EXECUTE sem delivery DELIVERED",
      );
      return undefined;
    }

    return { sourceMissionId, delivery };
  }

  private buildOutcomesFromChildren(
    children: readonly Mission[],
  ): DelegationOutcome[] {
    return children
      .filter((child) => child.missionKind === MissionKind.EXECUTE)
      .flatMap((child): readonly DelegationOutcome[] => {
        const specialization = parseSpecialization(
          child.requiredSpecialization,
        );
        if (!specialization) {
          return [];
        }
        const request = {
          specialization,
          reason: child.objective,
          task: child.objective,
        };
        const stored = child.resultJson as ExecutePhaseResult | null;
        if (child.status !== "COMPLETED" || !stored?.employeeResult) {
          return [{ request, matched: false }];
        }
        return [
          {
            request,
            matched: true,
            employeeId: child.ownerEmployeeId,
            result: toEmployeeResult(
              stored.employeeResult,
              new BriefingBuilder().build(
                {
                  workspaceId: child.workspaceId,
                  name: "",
                  objective: child.objective,
                },
                child.objective,
              ),
            ),
            executionReport: stored.executionReport,
          },
        ];
      });
  }
}

/** Resumo curto de evidencias para MissionEvent (sem payload gigante). */
function summarizeDeliveryEvidence(
  evidence: readonly {
    readonly source: string;
    readonly data: Readonly<Record<string, unknown>>;
  }[],
): readonly {
  readonly source: string;
  readonly data: Readonly<Record<string, unknown>>;
}[] {
  return evidence.map((item) => {
    if (item.source === "listDirectory" && Array.isArray(item.data.entries)) {
      const entries = item.data.entries as readonly { name?: string }[];
      return {
        source: item.source,
        data: {
          repository: item.data.repository,
          path: item.data.path,
          entryCount: item.data.entryCount ?? entries.length,
          names: entries.slice(0, 30).map((entry) => entry.name ?? ""),
        },
      };
    }
    return {
      source: item.source,
      data: { ...item.data },
    };
  });
}

const SPECIALIZATION_VALUES: ReadonlySet<string> = new Set(
  Object.values(Specialization),
);

function parseSpecialization(
  value: string | null | undefined,
): Specialization | undefined {
  if (!value || !SPECIALIZATION_VALUES.has(value)) {
    return undefined;
  }
  return value as Specialization;
}
