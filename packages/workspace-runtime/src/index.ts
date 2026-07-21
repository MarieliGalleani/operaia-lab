// Entidades do Workspace
export type { Workspace } from "./workspace/workspace.js";
export type { WorkspaceContext } from "./workspace/workspace-context.js";
export type { WorkspaceSession } from "./workspace/workspace-session.js";
export {
  WorkspaceSessionStatus,
  statusFromOrchestration,
} from "./workspace/workspace-state.js";

// Manager
export {
  WorkspaceManager,
  type WorkspaceManagerDependencies,
  type StartSessionInput,
} from "./workspace/workspace-manager.js";

// Ports
export type { WorkspaceStore } from "./ports/workspace-store.js";
export type { SessionStore } from "./ports/session-store.js";
export type { WorkspaceLoader } from "./ports/workspace-loader.js";
export type {
  SessionRunner,
  SessionRunInput,
} from "./ports/session-runner.js";

// Defaults
export { InMemoryWorkspaceStore } from "./defaults/in-memory-workspace-store.js";
export { InMemorySessionStore } from "./defaults/in-memory-session-store.js";
export { InMemoryMemoryStore } from "./defaults/in-memory-memory-store.js";

// Composition
export {
  createWorkspaceRuntime,
  type WorkspaceRuntime,
  type WorkspaceRuntimeConfig,
} from "./composition/composition-root.js";
export {
  composeOrchestration,
  type RuntimeComposerConfig,
} from "./composition/runtime-composer.js";
export { PlanMapper } from "./composition/plan-mapper.js";
export { PlaceholderLLMProvider } from "./composition/placeholder-llm-provider.js";

// Adapters
export {
  RuntimeAdapter,
  type RuntimeAdapterDependencies,
} from "./adapters/runtime-adapter.js";
export { ExecutionAdapter } from "./adapters/execution-adapter.js";
export { OrchestrationAdapter } from "./adapters/orchestration-adapter.js";

// Erros
export {
  InvalidWorkspacePlanError,
  SessionNotFoundError,
  WorkspaceNotFoundError,
} from "./errors/workspace-errors.js";
