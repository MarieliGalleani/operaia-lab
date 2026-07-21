import type { LLMCompletionOptions } from "@operaia/ai-core";
import type { MemoryStore } from "@operaia/memory";
import { NoopActionParser } from "../defaults/noop-action-parser.js";
import { AgentNotFoundError, InactiveAgentError } from "../errors.js";
import type { ActionParser } from "../ports/action-parser.js";
import type { AgentLoader } from "../ports/agent-loader.js";
import { systemClock, type Clock } from "../ports/clock.js";
import type { LLMSelector } from "../ports/llm-selector.js";
import type { PromptBuilder } from "../ports/prompt-builder.js";
import type { ToolProvider } from "../ports/tool-provider.js";
import type { ExecutionContext, RuntimeInput } from "../types/execution-context.js";
import { ExecutionStep } from "../types/execution-plan.js";
import type { RuntimeResponse } from "../types/runtime-response.js";
import { buildExecutionPlan } from "./execution-plan-builder.js";
import { RuntimeLogger } from "./runtime-logger.js";

const DEFAULT_MEMORY_TOP_K = 5;

/** Dependencias do runtime, injetadas por construtor (sem singletons globais). */
export interface AgentRuntimeDependencies {
  readonly agentLoader: AgentLoader;
  readonly memoryStore: MemoryStore;
  readonly toolProvider: ToolProvider;
  readonly promptBuilder: PromptBuilder;
  readonly llmSelector: LLMSelector;
  readonly actionParser?: ActionParser;
  readonly clock?: Clock;
  readonly completionOptions?: LLMCompletionOptions;
}

/**
 * Kernel do OperaIA.lab. Orquestra o pipeline de execucao de um agente,
 * dependendo apenas de contratos (ports). Nao conhece provedores concretos.
 */
export class AgentRuntime {
  private readonly agentLoader: AgentLoader;
  private readonly memoryStore: MemoryStore;
  private readonly toolProvider: ToolProvider;
  private readonly promptBuilder: PromptBuilder;
  private readonly llmSelector: LLMSelector;
  private readonly actionParser: ActionParser;
  private readonly clock: Clock;
  private readonly completionOptions: LLMCompletionOptions | undefined;

  constructor(deps: AgentRuntimeDependencies) {
    this.agentLoader = deps.agentLoader;
    this.memoryStore = deps.memoryStore;
    this.toolProvider = deps.toolProvider;
    this.promptBuilder = deps.promptBuilder;
    this.llmSelector = deps.llmSelector;
    this.actionParser = deps.actionParser ?? new NoopActionParser();
    this.clock = deps.clock ?? systemClock;
    this.completionOptions = deps.completionOptions;
  }

  async run(input: RuntimeInput): Promise<RuntimeResponse> {
    const logger = new RuntimeLogger(this.clock);
    const startedAt = this.clock.now();

    // 1. Load Agent
    const agent = await logger.track(
      ExecutionStep.LOAD_AGENT,
      async () => {
        const loaded = await this.agentLoader.load(input.agentKey);
        if (!loaded) {
          throw new AgentNotFoundError(input.agentKey);
        }
        if (!loaded.active) {
          throw new InactiveAgentError(input.agentKey);
        }
        return loaded;
      },
      (loaded) => `Agente carregado: ${loaded.name}.`,
    );

    // 2. Build Context
    const memoryTopK = await logger.track(
      ExecutionStep.BUILD_CONTEXT,
      () => input.memoryTopK ?? DEFAULT_MEMORY_TOP_K,
      (topK) => `Contexto base preparado (memoryTopK=${topK}).`,
    );

    // 3. Load Memory
    const memory = await logger.track(
      ExecutionStep.LOAD_MEMORY,
      () => this.memoryStore.search({ text: input.message, topK: memoryTopK }),
      (results) => `Memoria consultada: ${results.length} registro(s).`,
    );

    // 4. Discover Tools
    const tools = await logger.track(
      ExecutionStep.DISCOVER_TOOLS,
      () => this.toolProvider.discover({ agent, input }),
      (discovered) => `Ferramentas descobertas: ${discovered.length}.`,
    );

    const context: ExecutionContext = {
      agent,
      input,
      memory,
      tools,
      startedAt,
    };

    // 5. Build Prompt
    const messages = await logger.track(
      ExecutionStep.BUILD_PROMPT,
      () => this.promptBuilder.build(context),
      (built) => `Prompt montado com ${built.length} mensagem(ns).`,
    );

    // 6. Generate Execution Plan (inclui selecao do provider)
    const { provider, plan } = await logger.track(
      ExecutionStep.GENERATE_EXECUTION_PLAN,
      async () => {
        const selected = await this.llmSelector.select(context);
        const model = this.completionOptions?.model ?? selected.name;
        const builtPlan = buildExecutionPlan({
          model,
          memoryTopK,
          memoryHits: memory.length,
          toolNames: tools.map((tool) => tool.name),
          promptSize: messages.length,
        });
        return { provider: selected, plan: builtPlan };
      },
      (result) =>
        `Plano gerado (provider=${result.provider.name}, modelo=${result.plan.model}).`,
    );

    // 7. Execute LLM
    const completion = await logger.track(
      ExecutionStep.EXECUTE_LLM,
      () => provider.complete(messages, this.completionOptions),
      (result) => `Modelo respondeu (${result.content.length} caracteres).`,
    );

    // 8. Return RuntimeResponse
    return {
      output: completion.content,
      plan,
      actions: this.actionParser.parse(completion),
      usage: completion.usage ?? null,
      logs: logger.snapshot(),
    };
  }
}
