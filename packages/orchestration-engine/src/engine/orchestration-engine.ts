import { randomUUID } from "node:crypto";
import { InMemoryStateStore } from "../defaults/in-memory-state-store.js";
import { NoopEventPublisher } from "../defaults/noop-event-publisher.js";
import {
  createEvent,
  OrchestrationEventType,
} from "../events/orchestration-events.js";
import { systemClock, type Clock } from "../ports/clock.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { ExecutionEnginePort } from "../ports/execution-engine.js";
import type { RuntimePort } from "../ports/runtime.js";
import type { StateStore } from "../ports/state-store.js";
import { defaultLoopPolicy, type LoopPolicy } from "../policies/loop-policy.js";
import { NoRetryPolicy, type RetryPolicy } from "../policies/retry-policy.js";
import { DefaultStopPolicy, type StopPolicy } from "../policies/stop-policy.js";
import type { OrchestrationContext } from "./orchestration-context.js";
import { OrchestrationLoop } from "./orchestration-loop.js";
import type { OrchestrationResult } from "./orchestration-result.js";
import {
  OrchestrationStatus,
  type OrchestrationState,
} from "./orchestration-state.js";

export interface OrchestrationEngineDependencies {
  readonly runtime: RuntimePort;
  readonly executionEngine: ExecutionEnginePort;
  readonly loopPolicy?: LoopPolicy;
  readonly stopPolicy?: StopPolicy;
  readonly retryPolicy?: RetryPolicy;
  readonly stateStore?: StateStore;
  readonly eventPublisher?: EventPublisher;
  readonly clock?: Clock;
}

export interface RunOptions {
  readonly objective: string;
  readonly id?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly signal?: AbortSignal;
}

/**
 * O sistema nervoso do OperaIA.lab. Coordena o ciclo de vida de um objetivo
 * acionando Runtime e Execution Engine atraves de ports. Nao pensa, nao executa
 * e nao conhece nenhuma implementacao concreta nem agente especifico.
 */
export class OrchestrationEngine {
  private readonly stateStore: StateStore;
  private readonly eventPublisher: EventPublisher;
  private readonly clock: Clock;
  private readonly loop: OrchestrationLoop;

  constructor(deps: OrchestrationEngineDependencies) {
    this.stateStore = deps.stateStore ?? new InMemoryStateStore();
    this.eventPublisher = deps.eventPublisher ?? new NoopEventPublisher();
    this.clock = deps.clock ?? systemClock;
    this.loop = new OrchestrationLoop({
      runtime: deps.runtime,
      executionEngine: deps.executionEngine,
      stateStore: this.stateStore,
      eventPublisher: this.eventPublisher,
      clock: this.clock,
      loopPolicy: deps.loopPolicy ?? defaultLoopPolicy,
      stopPolicy: deps.stopPolicy ?? new DefaultStopPolicy(),
      retryPolicy: deps.retryPolicy ?? new NoRetryPolicy(),
    });
  }

  async run(options: RunOptions): Promise<OrchestrationResult> {
    const startedAt = this.clock.now();
    const state: OrchestrationState = {
      id: options.id ?? randomUUID(),
      objective: options.objective,
      currentCycle: 0,
      status: OrchestrationStatus.CREATED,
      startedAt,
      finishedAt: null,
      lastExecution: null,
      history: [],
    };

    await this.stateStore.save(state);
    await this.emit(OrchestrationEventType.LOOP_STARTED, state);

    const context: OrchestrationContext = {
      id: state.id,
      objective: state.objective,
      metadata: options.metadata ?? {},
      signal: options.signal,
    };

    await this.loop.run(state, context);
    await this.emit(OrchestrationEventType.LOOP_FINISHED, state, {
      status: state.status,
    });

    return this.buildResult(state);
  }

  private buildResult(state: OrchestrationState): OrchestrationResult {
    const finishedAt = state.finishedAt ?? this.clock.now();
    return {
      id: state.id,
      status: state.status,
      cycles: state.currentCycle,
      history: state.history,
      startedAt: state.startedAt,
      finishedAt,
      duration: finishedAt.getTime() - state.startedAt.getTime(),
      objectiveCompleted: state.status === OrchestrationStatus.COMPLETED,
      executionSummary: state.lastExecution,
    };
  }

  private async emit(
    type: OrchestrationEventType,
    state: OrchestrationState,
    data?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.eventPublisher.publish(
      createEvent(type, state, this.clock.now(), data),
    );
  }
}
