import { describe, expect, it } from "vitest";
import {
  createLLMStack,
  DeterministicLLMProvider,
  FallbackLLMProvider,
  MaxTokensClampPolicy,
  NonEmptyPromptPolicy,
  ObservableLLMProvider,
  PolicyLLMProvider,
  RecordingLLMObserver,
  type LLMCompletion,
  type LLMCompletionOptions,
  type LLMMessage,
  type LLMProvider,
} from "./index.js";

class FailingLLM implements LLMProvider {
  readonly name = "failing";
  async complete(): Promise<LLMCompletion> {
    throw new Error("falha simulada");
  }
}

class CapturingLLM implements LLMProvider {
  readonly name = "capturing";
  public lastOptions: LLMCompletionOptions | undefined;
  async complete(
    _messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion> {
    this.lastOptions = options;
    return { content: "ok", model: "capturing" };
  }
}

describe("Etapa 6 — observabilidade", () => {
  it("emite started e succeeded em volta do provider", async () => {
    const observer = new RecordingLLMObserver();
    const llm = new ObservableLLMProvider(
      new DeterministicLLMProvider(),
      observer,
    );

    await llm.complete([{ role: "user", content: "plano inicial" }]);

    const types = observer.snapshot().map((event) => event.type);
    expect(types).toEqual(["call_started", "call_succeeded"]);
  });

  it("emite call_failed quando o provider falha", async () => {
    const observer = new RecordingLLMObserver();
    const llm = new ObservableLLMProvider(new FailingLLM(), observer);

    await expect(
      llm.complete([{ role: "user", content: "x" }]),
    ).rejects.toThrow(/falha simulada/);

    expect(observer.snapshot().map((event) => event.type)).toEqual([
      "call_started",
      "call_failed",
    ]);
  });
});

describe("Etapa 6 — fallback", () => {
  it("usa o segundo provider quando o primeiro falha", async () => {
    const observer = new RecordingLLMObserver();
    const llm = new FallbackLLMProvider(
      [new FailingLLM(), new DeterministicLLMProvider()],
      observer,
    );

    const result = await llm.complete([
      { role: "user", content: "plano inicial" },
    ]);
    expect(result.content).toContain("Analisei o workspace");

    const fallback = observer
      .snapshot()
      .find((event) => event.type === "fallback_used");
    expect(fallback).toMatchObject({
      type: "fallback_used",
      fromProvider: "failing",
      toProvider: "deterministic",
    });
  });
});

describe("Etapa 6 — policy layer", () => {
  it("rejeita prompt vazio", async () => {
    const llm = new PolicyLLMProvider(
      new DeterministicLLMProvider(),
      new NonEmptyPromptPolicy(),
    );
    await expect(
      llm.complete([{ role: "user", content: "   " }]),
    ).rejects.toThrow(/prompt vazio/);
  });

  it("aplica clamp de maxTokens", async () => {
    const inner = new CapturingLLM();
    const llm = new PolicyLLMProvider(inner, new MaxTokensClampPolicy(100));
    await llm.complete([{ role: "user", content: "ola" }], {
      maxTokens: 5000,
    });
    expect(inner.lastOptions?.maxTokens).toBe(100);
  });
});

describe("Etapa 6 — createLLMStack", () => {
  it("monta stack deterministico com observabilidade para testes", async () => {
    const observer = new RecordingLLMObserver();
    const llm = createLLMStack({
      provider: "deterministic",
      observer,
      enableConsoleObservability: false,
    });

    const result = await llm.complete([
      { role: "user", content: "plano inicial" },
    ]);
    expect(result.content).toContain("Analisei");
    expect(observer.snapshot().some((e) => e.type === "call_succeeded")).toBe(
      true,
    );
  });

  it("ignora fallback nao implementado sem quebrar o primario", async () => {
    const observer = new RecordingLLMObserver();
    const llm = createLLMStack({
      provider: "deterministic",
      fallbackProviders: ["openai", "anthropic"],
      observer,
      enableConsoleObservability: false,
    });

    const result = await llm.complete([
      { role: "user", content: "plano inicial" },
    ]);
    expect(result.content).toContain("Analisei");
  });
});
