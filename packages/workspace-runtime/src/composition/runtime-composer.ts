import type { AgentRuntime, RuntimeResponse } from "@operaia/agent-runtime";
import type {
  ExecutionEngine,
  ExecutionPlan,
} from "@operaia/execution-engine";
import {
  OrchestrationEngine,
  type Clock,
  type EventPublisher,
  type LoopPolicy,
  type RetryPolicy,
  type StateStore,
  type StopPolicy,
} from "@operaia/orchestration-engine";
import { ExecutionAdapter } from "../adapters/execution-adapter.js";
import { OrchestrationAdapter } from "../adapters/orchestration-adapter.js";
import { RuntimeAdapter } from "../adapters/runtime-adapter.js";
import { PlanMapper } from "./plan-mapper.js";

export interface RuntimeComposerConfig {
  readonly agentRuntime: AgentRuntime;
  readonly executionEngine: ExecutionEngine;
  readonly agentKey: string;
  readonly planMapper?: PlanMapper;
  readonly isObjectiveComplete?: (
    response: RuntimeResponse,
    plan: ExecutionPlan,
  ) => boolean;
  readonly loopPolicy?: LoopPolicy;
  readonly stopPolicy?: StopPolicy;
  readonly retryPolicy?: RetryPolicy;
  readonly stateStore?: StateStore;
  readonly eventPublisher?: EventPublisher;
  readonly clock?: Clock;
}

/**
 * Conecta Runtime, Execution e Orchestration atraves dos adapters e devolve o
 * OrchestrationAdapter pronto para uso. Nenhum engine conhece outro engine;
 * toda a fiacao acontece aqui.
 */
export function composeOrchestration(
  config: RuntimeComposerConfig,
): OrchestrationAdapter {
  const planMapper = config.planMapper ?? new PlanMapper();

  const runtimeAdapter = new RuntimeAdapter({
    agentRuntime: config.agentRuntime,
    planMapper,
    agentKey: config.agentKey,
    isObjectiveComplete: config.isObjectiveComplete,
  });

  const executionAdapter = new ExecutionAdapter(config.executionEngine);

  const orchestrationEngine = new OrchestrationEngine({
    runtime: runtimeAdapter,
    executionEngine: executionAdapter,
    loopPolicy: config.loopPolicy,
    stopPolicy: config.stopPolicy,
    retryPolicy: config.retryPolicy,
    stateStore: config.stateStore,
    eventPublisher: config.eventPublisher,
    clock: config.clock,
  });

  return new OrchestrationAdapter(orchestrationEngine);
}
