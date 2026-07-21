import type { AgentDefinition } from "@operaia/agents";
import type {
  LLMCompletion,
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
} from "@operaia/ai-core";
import type {
  MemoryQuery,
  MemorySearchResult,
  MemoryStore,
} from "@operaia/memory";
import { describe, expect, it } from "vitest";
import { DefaultPromptBuilder } from "../defaults/default-prompt-builder.js";
import { JsonActionParser } from "../defaults/json-action-parser.js";
import { SingleProviderSelector } from "../defaults/single-provider-selector.js";
import {
  AgentNotFoundError,
  InactiveAgentError,
} from "../errors.js";
import type { AgentLoader } from "../ports/agent-loader.js";
import type { Clock } from "../ports/clock.js";
import type { ToolProvider } from "../ports/tool-provider.js";
import { ExecutionStep } from "../types/execution-plan.js";
import type { Tool } from "../types/tool.js";
import { AgentRuntime } from "./agent-runtime.js";

const agent: AgentDefinition = {
  key: "ceo",
  name: "OperaIA CEO",
  role: "Coordenador",
  description: "Coordena o escritorio.",
  systemInstructions: "Voce e o OperaIA CEO.",
  active: true,
};

class IncrementingClock implements Clock {
  private ms = 0;
  now(): Date {
    this.ms += 1;
    return new Date(this.ms);
  }
}

class StubAgentLoader implements AgentLoader {
  constructor(
    private readonly definition: AgentDefinition | null,
    private readonly order?: string[],
  ) {}
  load(): AgentDefinition | null {
    this.order?.push("agent");
    return this.definition;
  }
}

class StubMemoryStore implements MemoryStore {
  lastQuery: MemoryQuery | null = null;
  constructor(
    private readonly results: readonly MemorySearchResult[],
    private readonly order?: string[],
  ) {}
  async store(): Promise<void> {}
  async search(query: MemoryQuery): Promise<readonly MemorySearchResult[]> {
    this.order?.push("memory");
    this.lastQuery = query;
    return this.results;
  }
}

class StubToolProvider implements ToolProvider {
  constructor(
    private readonly tools: readonly Tool[],
    private readonly order?: string[],
  ) {}
  discover(): readonly Tool[] {
    this.order?.push("tools");
    return this.tools;
  }
}

class RecordingProvider implements LLMProvider {
  readonly name = "fake-provider";
  lastMessages: readonly LLMMessage[] = [];
  lastOptions: LLMCompletionOptions | undefined;
  constructor(
    private readonly completion: LLMCompletion,
    private readonly order?: string[],
  ) {}
  async complete(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion> {
    this.order?.push("llm");
    this.lastMessages = messages;
    this.lastOptions = options;
    return this.completion;
  }
}

function memoryResult(content: string, score: number): MemorySearchResult {
  return { record: { id: crypto.randomUUID(), content }, score };
}

function buildRuntime(overrides: {
  loader?: AgentLoader;
  memory?: MemoryStore;
  tools?: ToolProvider;
  provider?: LLMProvider;
  options?: LLMCompletionOptions;
}): AgentRuntime {
  const provider =
    overrides.provider ??
    new RecordingProvider({ content: "Resposta", model: "fake-model" });
  return new AgentRuntime({
    agentLoader: overrides.loader ?? new StubAgentLoader(agent),
    memoryStore: overrides.memory ?? new StubMemoryStore([]),
    toolProvider: overrides.tools ?? new StubToolProvider([]),
    promptBuilder: new DefaultPromptBuilder(),
    llmSelector: new SingleProviderSelector(provider),
    actionParser: new JsonActionParser(),
    clock: new IncrementingClock(),
    ...(overrides.options ? { completionOptions: overrides.options } : {}),
  });
}

describe("AgentRuntime", () => {
  it("executa o pipeline completo e retorna uma RuntimeResponse", async () => {
    const provider = new RecordingProvider({
      content: "Plano do NEXO",
      model: "fake-model",
      usage: { promptTokens: 10, completionTokens: 5 },
    });
    const runtime = buildRuntime({
      memory: new StubMemoryStore([memoryResult("NEXO e prioritario", 0.9)]),
      tools: new StubToolProvider([
        { name: "create_task", description: "cria uma tarefa" },
      ]),
      provider,
      options: { model: "gpt-test" },
    });

    const response = await runtime.run({
      agentKey: "ceo",
      message: "Analise o NEXO",
    });

    expect(response.output).toBe("Plano do NEXO");
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
    expect(response.plan.model).toBe("gpt-test");
    expect(response.plan.memoryHits).toBe(1);
    expect(response.plan.toolNames).toEqual(["create_task"]);
    expect(response.plan.steps.map((s) => s.step)).toEqual([
      ExecutionStep.LOAD_AGENT,
      ExecutionStep.BUILD_CONTEXT,
      ExecutionStep.LOAD_MEMORY,
      ExecutionStep.DISCOVER_TOOLS,
      ExecutionStep.BUILD_PROMPT,
      ExecutionStep.GENERATE_EXECUTION_PLAN,
      ExecutionStep.EXECUTE_LLM,
    ]);
    expect(response.logs).toHaveLength(7);
    expect(response.logs.every((log) => typeof log.durationMs === "number")).toBe(
      true,
    );
    expect(provider.lastOptions).toEqual({ model: "gpt-test" });
  });

  it("injeta memoria e ferramentas no prompt enviado ao provider", async () => {
    const provider = new RecordingProvider({
      content: "ok",
      model: "fake-model",
    });
    const runtime = buildRuntime({
      memory: new StubMemoryStore([memoryResult("NEXO e um projeto", 0.8)]),
      tools: new StubToolProvider([
        { name: "create_task", description: "cria uma tarefa" },
      ]),
      provider,
    });

    await runtime.run({ agentKey: "ceo", message: "Oi" });

    const contents = provider.lastMessages.map((m) => m.content);
    expect(contents[0]).toContain("OperaIA CEO");
    expect(contents.some((c) => c.includes("create_task"))).toBe(true);
    expect(contents.some((c) => c.includes("NEXO e um projeto"))).toBe(true);
    const last = provider.lastMessages.at(-1);
    expect(last?.role).toBe("user");
    expect(last?.content).toBe("Oi");
  });

  it("respeita a ordem obrigatoria do pipeline", async () => {
    const order: string[] = [];
    const provider = new RecordingProvider(
      { content: "ok", model: "fake-model" },
      order,
    );
    const runtime = new AgentRuntime({
      agentLoader: new StubAgentLoader(agent, order),
      memoryStore: new StubMemoryStore([], order),
      toolProvider: new StubToolProvider([], order),
      promptBuilder: new DefaultPromptBuilder(),
      llmSelector: new SingleProviderSelector(provider),
      clock: new IncrementingClock(),
    });

    await runtime.run({ agentKey: "ceo", message: "Oi" });

    expect(order).toEqual(["agent", "memory", "tools", "llm"]);
  });

  it("usa o memoryTopK informado ao consultar a memoria", async () => {
    const memory = new StubMemoryStore([]);
    const runtime = buildRuntime({ memory });

    await runtime.run({ agentKey: "ceo", message: "Oi", memoryTopK: 3 });

    expect(memory.lastQuery).toEqual({ text: "Oi", topK: 3 });
  });

  it("lanca AgentNotFoundError quando o agente nao existe", async () => {
    const runtime = buildRuntime({ loader: new StubAgentLoader(null) });
    await expect(
      runtime.run({ agentKey: "inexistente", message: "Oi" }),
    ).rejects.toBeInstanceOf(AgentNotFoundError);
  });

  it("lanca InactiveAgentError quando o agente esta inativo", async () => {
    const runtime = buildRuntime({
      loader: new StubAgentLoader({ ...agent, active: false }),
    });
    await expect(
      runtime.run({ agentKey: "ceo", message: "Oi" }),
    ).rejects.toBeInstanceOf(InactiveAgentError);
  });

  it("extrai acoes propostas da resposta do modelo", async () => {
    const provider = new RecordingProvider({
      content:
        'Segue o plano:\n```json\n{"actions":[{"type":"create_task","payload":{"title":"Kickoff"}}]}\n```',
      model: "fake-model",
    });
    const runtime = buildRuntime({ provider });

    const response = await runtime.run({ agentKey: "ceo", message: "Planeje" });

    expect(response.actions).toEqual([
      { type: "create_task", payload: { title: "Kickoff" } },
    ]);
  });
});
