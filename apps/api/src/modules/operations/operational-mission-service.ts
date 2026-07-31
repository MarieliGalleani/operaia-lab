import { randomUUID } from "node:crypto";
import type { RecordingLLMObserver } from "@operaia/ai-core";
import type { MemoryStore } from "@operaia/memory";
import {
  defaultIntentRouter,
  formatObjectiveWithIntent,
  type IntentRouter,
  type MissionIntent,
} from "@operaia/mission-router";
import type { DigitalOffice } from "../employees/office-composition.js";
import { MissionOrchestrator } from "../employees/mission-orchestrator.js";
import { presentMissionResult } from "../employees/mission-presenter.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import { CEO_EMPLOYEE_ID } from "../runtime/mission-states.js";
import { identifyOperationalGaps } from "./identify-operational-gaps.js";
import {
  loadOperationalMemoryNotes,
  persistMissionMemory,
} from "./mission-memory.js";
import type { MissionExecutionStack } from "./mission-execution.js";
import type { OperationalRun } from "./operational-run.js";
import type { OperationalRunStore } from "./operational-run-store.js";
import {
  projectMissionTreeToOperationalRun,
  projectPendingMissionTreeToOperationalRun,
  type QueueMissionNode,
} from "./operational-run-from-queue.js";
import {
  waitUntilTerminal,
  AssistedQueueMissionFailedError,
  MissionWaitTimeoutError,
  type WaitUntilTerminalOptions,
} from "./mission-wait.js";
import {
  resolveAssistedExecutionConfig,
  type AssistedExecutionConfig,
} from "./assisted-execution-config.js";

export {
  AssistedQueueMissionFailedError,
  MissionWaitTimeoutError,
} from "./mission-wait.js";

export interface RunOperationalMissionInput {
  readonly workspaceId: string;
  readonly objective: string;
  /** Employee porta-voz (default: Opera). */
  readonly employeeId?: string;
}

/**
 * Porta minima da fila para Assisted (testes sem Prisma).
 * Compativel com MissionQueue.enqueue / get / listChildren.
 */
export interface AssistedMissionQueuePort {
  enqueue(input: {
    readonly workspaceId: string;
    readonly objective: string;
    readonly ownerEmployeeId?: string;
    readonly dedupe?: boolean;
  }): Promise<{ mission: { id: string }; created: boolean }>;
  get(id: string): Promise<QueueMissionNode | null>;
  listChildren(parentMissionId: string): Promise<readonly QueueMissionNode[]>;
}

export interface OperationalMissionServiceOptions {
  /** Fila oficial (ADR-007). Ausente → so Path A sync. */
  readonly queue?: AssistedMissionQueuePort;
  /**
   * Quando true e queue presente, `run()` usa MissionQueue + projector.
   * Default: false (seguro).
   */
  readonly preferQueue?: boolean;
  readonly wait?: WaitUntilTerminalOptions;
  /** A.4.2 — default RuleBasedIntentRouter. */
  readonly intentRouter?: IntentRouter;
}

/**
 * Ciclo operacional assistido.
 * Path B (default produto via ASSISTED_QUEUE_MODE): MissionQueue → wait → projector.
 * Path A (kill-switch / lab): MissionOrchestrator sync → OperationalRun.
 *
 * A.4.2: Mission Intent Router classifica a mensagem antes de criar a missao.
 * CEO permanece coordenadora (COORDINATE / sync start); intent marca o especialista.
 */
export class OperationalMissionService {
  private readonly orchestrator: MissionOrchestrator;
  private queue: AssistedMissionQueuePort | undefined;
  private preferQueue: boolean;
  private readonly waitOptions: WaitUntilTerminalOptions;
  private readonly intentRouter: IntentRouter;

  constructor(
    office: DigitalOffice,
    private readonly workspaces: WorkspaceSource,
    private readonly observer: RecordingLLMObserver,
    private readonly store: OperationalRunStore,
    private readonly memory: MemoryStore,
    execution: MissionExecutionStack,
    options: OperationalMissionServiceOptions = {},
  ) {
    this.orchestrator = new MissionOrchestrator(office, execution);
    this.queue = options.queue;
    this.preferQueue = resolveAssistedExecutionConfig({
      preferQueue: options.preferQueue,
    }).preferQueue;
    this.waitOptions = options.wait ?? {};
    this.intentRouter = options.intentRouter ?? defaultIntentRouter;
  }

  /** Late-binding (product: ContinuousRuntime.queue apos composition). */
  bindQueue(queue: AssistedMissionQueuePort): void {
    this.queue = queue;
  }

  setPreferQueue(prefer: boolean): void {
    this.preferQueue = prefer;
  }

  get prefersQueue(): boolean {
    return this.preferQueue;
  }

  get hasQueue(): boolean {
    return this.queue !== undefined;
  }

  get assistedConfig(): AssistedExecutionConfig {
    return { preferQueue: this.preferQueue };
  }

  /** Expoe o ultimo intent classificado (testes / observabilidade). */
  routeIntent(message: string, workspaceId: string): MissionIntent {
    return this.intentRouter.route(message, workspaceId);
  }

  async run(input: RunOperationalMissionInput): Promise<OperationalRun> {
    const intent = this.intentRouter.route(input.objective, input.workspaceId);
    const routed: RunOperationalMissionInput & { readonly intent: MissionIntent } =
      {
        ...input,
        objective: formatObjectiveWithIntent(input.objective, intent),
        intent,
      };

    console.log("[mission-intent-router]", {
      workspaceId: intent.workspaceId,
      intentType: intent.intentType,
      suggestedEmployee: intent.suggestedEmployee,
      confidence: intent.confidence,
    });

    if (this.preferQueue) {
      return this.runViaQueue(routed);
    }
    return this.runSync(routed);
  }

  /**
   * Fachada Assisted → MissionQueue (Unified Mission Gateway / ADR-007).
   * Enfileira COORDINATE, aguarda terminal (com timeout), projeta OperationalRun.
   * `run.id` = Mission.id persistido na fila.
   */
  async runViaQueue(
    input: RunOperationalMissionInput,
  ): Promise<OperationalRun> {
    if (!this.queue) {
      throw new Error(
        "MissionQueue nao configurada no OperationalMissionService (preferQueue/ASSISTED_QUEUE_MODE)",
      );
    }

    const workspace = await this.workspaces.getWorkspace(input.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace nao encontrado: ${input.workspaceId}`);
    }

    const requestedEmployeeId = input.employeeId ?? CEO_EMPLOYEE_ID;
    if (requestedEmployeeId !== CEO_EMPLOYEE_ID) {
      console.log("[assisted-facade] employeeId forced to Opera", {
        requested: requestedEmployeeId,
        ownerEmployeeId: CEO_EMPLOYEE_ID,
        workspaceId: input.workspaceId,
      });
    }

    const { mission } = await this.queue.enqueue({
      workspaceId: input.workspaceId,
      objective: input.objective,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: false,
    });

    let timedOut = false;
    try {
      await waitUntilTerminal(this.queue, mission.id, this.waitOptions);
    } catch (error) {
      if (error instanceof MissionWaitTimeoutError) {
        timedOut = true;
        console.log(
          JSON.stringify({
            level: "warn",
            component: "assisted-facade",
            event: "wait_timeout",
            missionId: error.missionId,
            timeoutMs: error.timeoutMs,
            lastStatus: error.lastStatus,
          }),
        );
      } else {
        throw error;
      }
    }

    const root = await this.queue.get(mission.id);
    if (!root) {
      throw new Error(`Missao nao encontrada apos wait: ${mission.id}`);
    }

    const children = await this.queue.listChildren(mission.id);

    if (timedOut) {
      const pending = projectPendingMissionTreeToOperationalRun({
        root,
        children,
        workspaceName: workspace.name,
        requestedEmployeeId,
        runStatus: "timed_out",
        waitTimeoutMs: this.waitOptions.timeoutMs ?? 180_000,
      });
      this.store.save(pending);
      return pending;
    }

    if (root.status === "FAILED" || root.status === "CANCELLED") {
      throw new AssistedQueueMissionFailedError(root.id, root.status);
    }

    if (root.status !== "COMPLETED") {
      const pending = projectPendingMissionTreeToOperationalRun({
        root,
        children,
        workspaceName: workspace.name,
        requestedEmployeeId,
        runStatus: "in_progress",
      });
      this.store.save(pending);
      return pending;
    }

    const run = projectMissionTreeToOperationalRun({
      root,
      children,
      workspaceName: workspace.name,
      requestedEmployeeId,
    });

    this.store.save(run);
    return run;
  }

  private async runSync(
    input: RunOperationalMissionInput & { readonly intent?: MissionIntent },
  ): Promise<OperationalRun> {
    const workspace = await this.workspaces.getWorkspace(input.workspaceId);
    const snapshot = await this.workspaces.toSnapshot(input.workspaceId);
    if (!workspace || !snapshot) {
      throw new Error(`Workspace nao encontrado: ${input.workspaceId}`);
    }

    this.observer.clear();
    const startedAt = new Date().toISOString();
    const employeeId = input.employeeId ?? CEO_EMPLOYEE_ID;
    const missionId = randomUUID();
    const displayObjective = input.intent?.message ?? input.objective;

    const memoryNotes = await loadOperationalMemoryNotes(this.memory, {
      workspaceId: input.workspaceId,
      objective: displayObjective,
    });

    const mission = await this.orchestrator.run(employeeId, {
      workspace: snapshot,
      objective: input.objective,
      memoryNotes,
    });

    const finishedAt = new Date().toISOString();
    const llmEvents = this.observer.snapshot();
    const presented = presentMissionResult(
      mission,
      input.workspaceId,
      workspace.name,
    );
    const gaps = identifyOperationalGaps(mission, llmEvents);

    const run: OperationalRun = {
      id: missionId,
      status: "completed",
      workspaceId: input.workspaceId,
      workspaceName: workspace.name,
      objective: displayObjective,
      startedAt,
      finishedAt,
      mission,
      reply: presented.reply,
      workflow: presented.workflow,
      llmEvents,
      gaps,
      usableResult: presented.reply.content,
      execution: {
        planId: mission.executionPlan.id,
        status: mission.executionResult.status,
        executionId: mission.executionResult.executionId,
        durationMs: mission.executionResult.durationMs,
        results: mission.executionSummaries,
      },
      timing: mission.timing,
    };

    await persistMissionMemory(this.memory, {
      workspaceId: input.workspaceId,
      missionId: run.id,
      objective: displayObjective,
      summary: run.usableResult,
    });

    this.store.save(run);
    return run;
  }

  get(id: string): OperationalRun | undefined {
    return this.store.get(id);
  }

  list(): readonly OperationalRun[] {
    return this.store.list();
  }
}
