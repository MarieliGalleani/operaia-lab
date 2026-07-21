import {
  createEvent,
  OrchestrationEventType,
  type OrchestrationEvent,
} from "../events/orchestration-events.js";
import { FatalOrchestrationError } from "../errors/orchestration-errors.js";
import type { Clock } from "../ports/clock.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type {
  ExecutionEnginePort,
  ExecutionSummary,
} from "../ports/execution-engine.js";
import type { RuntimePort } from "../ports/runtime.js";
import type { StateStore } from "../ports/state-store.js";
import type { LoopPolicy } from "../policies/loop-policy.js";
import type { RetryPolicy } from "../policies/retry-policy.js";
import { statusFromStopReason, type StopPolicy } from "../policies/stop-policy.js";
import type { OrchestrationContext } from "./orchestration-context.js";
import {
  OrchestrationStatus,
  type CycleRecord,
  type OrchestrationState,
} from "./orchestration-state.js";

export interface OrchestrationLoopDependencies {
  readonly runtime: RuntimePort;
  readonly executionEngine: ExecutionEnginePort;
  readonly stateStore: StateStore;
  readonly eventPublisher: EventPublisher;
  readonly clock: Clock;
  readonly loopPolicy: LoopPolicy;
  readonly stopPolicy: StopPolicy;
  readonly retryPolicy: RetryPolicy;
}

interface CycleOutcome {
  readonly objectiveCompleted: boolean;
  readonly execution: ExecutionSummary | null;
  readonly error: string | null;
  readonly fatal: boolean;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Coordena os ciclos: Runtime -> plano -> Execution -> estado -> decidir parar.
 * Nao conhece implementacoes concretas; opera somente sobre ports e policies.
 */
export class OrchestrationLoop {
  constructor(private readonly deps: OrchestrationLoopDependencies) {}

  async run(
    state: OrchestrationState,
    context: OrchestrationContext,
  ): Promise<void> {
    const loopStart = this.deps.clock.now().getTime();

    for (;;) {
      if (context.signal?.aborted) {
        await this.finalize(state, OrchestrationStatus.CANCELLED);
        return;
      }

      await this.startCycle(state);
      const outcome = await this.runCycle(state, context);
      await this.recordCycle(state, outcome);

      const decision = this.deps.stopPolicy.evaluate({
        state,
        policy: this.deps.loopPolicy,
        elapsedMs: this.deps.clock.now().getTime() - loopStart,
        cancelled: context.signal?.aborted ?? false,
        fatal: outcome.fatal,
      });

      if (decision.stop) {
        await this.finalize(state, statusFromStopReason(decision.reason));
        return;
      }
    }
  }

  private async startCycle(state: OrchestrationState): Promise<void> {
    state.currentCycle += 1;
    const replanning =
      state.currentCycle > 1 && this.deps.loopPolicy.autoReplan;
    state.status = replanning
      ? OrchestrationStatus.REPLANNING
      : OrchestrationStatus.RUNNING;
    await this.persist(state);
    await this.emit(OrchestrationEventType.CYCLE_STARTED, state);
    if (replanning) {
      await this.emit(OrchestrationEventType.REPLANNING, state);
    }
  }

  private async runCycle(
    state: OrchestrationState,
    context: OrchestrationContext,
  ): Promise<CycleOutcome> {
    try {
      const runtimeOutcome = await this.withRetry(
        state,
        context,
        () =>
          this.deps.runtime.run({
            objective: state.objective,
            cycle: state.currentCycle,
            metadata: context.metadata,
            previousExecution: state.lastExecution,
          }),
      );

      const execution = await this.withRetry(state, context, () =>
        this.deps.executionEngine.execute(runtimeOutcome.plan),
      );
      state.lastExecution = execution;
      await this.emit(OrchestrationEventType.EXECUTION_COMPLETED, state, {
        status: execution.status,
      });

      if (runtimeOutcome.objectiveCompleted) {
        await this.emit(OrchestrationEventType.OBJECTIVE_COMPLETED, state);
      }

      return {
        objectiveCompleted: runtimeOutcome.objectiveCompleted,
        execution,
        error: null,
        fatal: false,
      };
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : String(caught);
      await this.emit(OrchestrationEventType.CYCLE_FAILED, state, { error });
      return {
        objectiveCompleted: false,
        execution: null,
        error,
        fatal: caught instanceof FatalOrchestrationError,
      };
    }
  }

  private async recordCycle(
    state: OrchestrationState,
    outcome: CycleOutcome,
  ): Promise<void> {
    const finishedAt = this.deps.clock.now();
    const previous = state.history.at(-1)?.finishedAt ?? state.startedAt;
    const record: CycleRecord = {
      cycle: state.currentCycle,
      startedAt: previous,
      finishedAt,
      durationMs: finishedAt.getTime() - previous.getTime(),
      objectiveCompleted: outcome.objectiveCompleted,
      execution: outcome.execution,
      error: outcome.error,
    };
    state.history.push(record);
    await this.persist(state);
  }

  private async withRetry<T>(
    state: OrchestrationState,
    context: OrchestrationContext,
    fn: () => Promise<T>,
  ): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await fn();
      } catch (error) {
        attempt += 1;
        if (
          context.signal?.aborted ||
          !this.deps.retryPolicy.shouldRetry(attempt, error)
        ) {
          throw error;
        }
        const delay = this.deps.retryPolicy.delayMs(attempt);
        if (delay > 0) {
          state.status = OrchestrationStatus.WAITING;
          await this.persist(state);
          await sleep(delay);
        }
      }
    }
  }

  private async finalize(
    state: OrchestrationState,
    status: OrchestrationStatus,
  ): Promise<void> {
    state.status = status;
    state.finishedAt = this.deps.clock.now();
    await this.persist(state);
  }

  private async persist(state: OrchestrationState): Promise<void> {
    await this.deps.stateStore.save(state);
  }

  private async emit(
    type: OrchestrationEventType,
    state: OrchestrationState,
    data?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const event: OrchestrationEvent = createEvent(
      type,
      state,
      this.deps.clock.now(),
      data,
    );
    await this.deps.eventPublisher.publish(event);
  }
}
