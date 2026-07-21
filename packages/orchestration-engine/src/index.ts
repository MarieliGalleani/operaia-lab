// Engine
export { OrchestrationEngine } from "./engine/orchestration-engine.js";
export type {
  OrchestrationEngineDependencies,
  RunOptions,
} from "./engine/orchestration-engine.js";
export { OrchestrationLoop } from "./engine/orchestration-loop.js";
export type { OrchestrationLoopDependencies } from "./engine/orchestration-loop.js";

// Estado, contexto e resultado
export {
  OrchestrationStatus,
  type CycleRecord,
  type OrchestrationState,
} from "./engine/orchestration-state.js";
export type { OrchestrationContext } from "./engine/orchestration-context.js";
export type { OrchestrationResult } from "./engine/orchestration-result.js";

// Ports (contratos neutros)
export type {
  RuntimePort,
  RuntimeRequest,
  RuntimeOutcome,
  ProposedPlan,
} from "./ports/runtime.js";
export {
  ExecutionOutcomeStatus,
  type ExecutionEnginePort,
  type ExecutionSummary,
} from "./ports/execution-engine.js";
export type { StateStore } from "./ports/state-store.js";
export type { EventPublisher } from "./ports/event-publisher.js";
export { systemClock, type Clock } from "./ports/clock.js";

// Policies
export { defaultLoopPolicy, type LoopPolicy } from "./policies/loop-policy.js";
export {
  NoRetryPolicy,
  ExponentialBackoffRetryPolicy,
  type RetryPolicy,
  type BackoffOptions,
} from "./policies/retry-policy.js";
export {
  DefaultStopPolicy,
  StopReason,
  statusFromStopReason,
  type StopPolicy,
  type StopDecision,
  type StopEvaluation,
} from "./policies/stop-policy.js";

// Eventos
export {
  OrchestrationEventType,
  createEvent,
  type OrchestrationEvent,
} from "./events/orchestration-events.js";

// Defaults
export { InMemoryStateStore } from "./defaults/in-memory-state-store.js";
export { NoopEventPublisher } from "./defaults/noop-event-publisher.js";

// Erros
export {
  OrchestrationError,
  FatalOrchestrationError,
} from "./errors/orchestration-errors.js";
