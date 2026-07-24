// Engine
export { ExecutionEngine } from "./execution/execution-engine.js";
export type { ExecutionEngineDependencies } from "./execution/execution-engine.js";

// Tipos de dominio
export {
  ActionType,
  ActionStatus,
  type Action,
  type ActionOutput,
} from "./execution/action.js";
export type { ExecutionPlan } from "./execution/execution-plan.js";
export type { ExecutionContext } from "./execution/execution-context.js";
export {
  ExecutionPhase,
  type ExecutionLog,
  type LogLevel,
} from "./execution/execution-log.js";
export {
  ExecutionStatus,
  type ActionResult,
  type ExecutionResult,
} from "./execution/execution-result.js";

// Ports (contratos injetaveis)
export type { ActionExecutor } from "./ports/executor.js";
export type { ExecutionStore } from "./ports/execution-store.js";
export { systemClock, type Clock } from "./ports/clock.js";

// Executores / Action Registry
export { BaseActionExecutor } from "./executors/action-executor.js";
export { ExecutorRegistry } from "./executors/registry.js";
export { ActionRegistry } from "./executors/action-registry.js";
export { TaskActionExecutor } from "./defaults/task-action-executor.js";
export { NoopExecutor } from "./defaults/noop-executor.js";

// Policy Layer
export {
  AllowAllActionPolicy,
  AllowlistActionPolicy,
  type ActionPolicy,
  type PolicyDecision,
} from "./policies/action-policy.js";

// Normalizacao de resultado
export {
  normalizeActionResult,
  normalizeExecutionResults,
  type NormalizedActionResult,
} from "./execution/normalize-result.js";

// Erros
export {
  ExecutionEngineError,
  InvalidExecutionPlanError,
  ExecutorNotFoundError,
} from "./errors/execution-errors.js";
