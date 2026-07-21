import {
  AgentRuntime,
  DefaultPromptBuilder,
  EmptyToolProvider,
  RegistryAgentLoader,
  SingleProviderSelector,
  type ToolProvider,
} from "@operaia/agent-runtime";
import type { LLMProvider } from "@operaia/ai-core";
import {
  ExecutionEngine,
  ExecutorRegistry,
  NoopExecutor,
  TaskActionExecutor,
} from "@operaia/execution-engine";
import type { MemoryStore } from "@operaia/memory";
import type {
  Clock,
  EventPublisher,
  LoopPolicy,
  RetryPolicy,
  StateStore,
  StopPolicy,
} from "@operaia/orchestration-engine";
import { InMemoryMemoryStore } from "../defaults/in-memory-memory-store.js";
import { InMemorySessionStore } from "../defaults/in-memory-session-store.js";
import { InMemoryWorkspaceStore } from "../defaults/in-memory-workspace-store.js";
import type { Workspace } from "../workspace/workspace.js";
import { WorkspaceManager } from "../workspace/workspace-manager.js";
import { PlaceholderLLMProvider } from "./placeholder-llm-provider.js";
import { composeOrchestration } from "./runtime-composer.js";

/**
 * Configuracao do Workspace Runtime. Tudo e injetavel; os defaults sao
 * placeholders (LLM e memoria) que fecham o circuito operacional sem
 * integracoes reais, substituiveis por DI.
 */
export interface WorkspaceRuntimeConfig {
  readonly agentKey?: string;
  readonly llmProvider?: LLMProvider;
  readonly memoryStore?: MemoryStore;
  readonly toolProvider?: ToolProvider;
  readonly initialWorkspaces?: readonly Workspace[];
  readonly loopPolicy?: LoopPolicy;
  readonly stopPolicy?: StopPolicy;
  readonly retryPolicy?: RetryPolicy;
  readonly stateStore?: StateStore;
  readonly eventPublisher?: EventPublisher;
  readonly clock?: Clock;
}

export interface WorkspaceRuntime {
  readonly manager: WorkspaceManager;
  readonly workspaceStore: InMemoryWorkspaceStore;
  readonly sessionStore: InMemorySessionStore;
}

const DEFAULT_AGENT_KEY = "operaia-ceo";

/**
 * COMPOSITION ROOT: o UNICO local autorizado a montar dependencias concretas.
 * Nenhum outro package deve conhecer implementacoes concretas dos engines.
 */
export function createWorkspaceRuntime(
  config: WorkspaceRuntimeConfig = {},
): WorkspaceRuntime {
  const llmProvider = config.llmProvider ?? new PlaceholderLLMProvider();
  const memoryStore = config.memoryStore ?? new InMemoryMemoryStore();
  const toolProvider = config.toolProvider ?? new EmptyToolProvider();

  const agentRuntime = new AgentRuntime({
    agentLoader: new RegistryAgentLoader(),
    memoryStore,
    toolProvider,
    promptBuilder: new DefaultPromptBuilder(),
    llmSelector: new SingleProviderSelector(llmProvider),
  });

  const registry = new ExecutorRegistry()
    .register(new TaskActionExecutor())
    .register(new NoopExecutor());
  const executionEngine = new ExecutionEngine({
    registry,
    clock: config.clock,
  });

  const orchestrationAdapter = composeOrchestration({
    agentRuntime,
    executionEngine,
    agentKey: config.agentKey ?? DEFAULT_AGENT_KEY,
    loopPolicy: config.loopPolicy,
    stopPolicy: config.stopPolicy,
    retryPolicy: config.retryPolicy,
    stateStore: config.stateStore,
    eventPublisher: config.eventPublisher,
    clock: config.clock,
  });

  const workspaceStore = new InMemoryWorkspaceStore(config.initialWorkspaces);
  const sessionStore = new InMemorySessionStore();

  const manager = new WorkspaceManager({
    workspaceLoader: workspaceStore,
    sessionStore,
    sessionRunner: orchestrationAdapter,
    clock: config.clock,
  });

  return { manager, workspaceStore, sessionStore };
}
