// Kernel
export { AgentRuntime } from "./runtime/agent-runtime.js";
export type { AgentRuntimeDependencies } from "./runtime/agent-runtime.js";
export { RuntimeLogger } from "./runtime/runtime-logger.js";
export {
  buildExecutionPlan,
  type ExecutionPlanParams,
} from "./runtime/execution-plan-builder.js";

// Tipos do dominio do runtime
export type { RuntimeInput, ExecutionContext } from "./types/execution-context.js";
export {
  ExecutionStep,
  type ExecutionPlan,
  type ExecutionPlanStep,
} from "./types/execution-plan.js";
export type {
  RuntimeResponse,
  RuntimeLog,
  RuntimeUsage,
  LogLevel,
} from "./types/runtime-response.js";
export type { AgentAction } from "./types/action.js";
export type { Tool } from "./types/tool.js";

// Ports (contratos injetaveis)
export type { AgentLoader } from "./ports/agent-loader.js";
export type { PromptBuilder } from "./ports/prompt-builder.js";
export type { ToolProvider, ToolDiscoveryContext } from "./ports/tool-provider.js";
export type { LLMSelector } from "./ports/llm-selector.js";
export type { ActionParser } from "./ports/action-parser.js";
export { systemClock, type Clock } from "./ports/clock.js";

// Implementacoes default (plugaveis, sem vendor)
export { RegistryAgentLoader } from "./defaults/registry-agent-loader.js";
export { DefaultPromptBuilder } from "./defaults/default-prompt-builder.js";
export { EmptyToolProvider } from "./defaults/empty-tool-provider.js";
export { SingleProviderSelector } from "./defaults/single-provider-selector.js";
export { NoopActionParser } from "./defaults/noop-action-parser.js";
export { JsonActionParser } from "./defaults/json-action-parser.js";

// Erros
export {
  RuntimeError,
  AgentNotFoundError,
  InactiveAgentError,
} from "./errors.js";
