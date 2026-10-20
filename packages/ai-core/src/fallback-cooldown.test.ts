import { beforeEach, describe, expect, it } from "vitest";
import type { LLMProvider } from "./llm-provider.js";
import { FallbackLLMProvider, isPermanentProviderError, resetProviderCooldowns } from "./providers/fallback-llm-provider.js";

function provider(name: string, impl: () => Promise<{ content: string; model: string }>): LLMProvider & { calls: number } {
  const p = { name, calls: 0, async complete() { p.calls += 1; return impl(); } };
  return p as unknown as LLMProvider & { calls: number };
}

describe("fallback pula provedor sem crédito", () => {
  beforeEach(() => resetProviderCooldowns());
  it("depois de erro de crédito, não tenta de novo por 10 min", async () => {
    const claude = provider("anthropic-test", async () => { throw Object.assign(new Error("Your credit balance is too low"), { status: 400 }); });
    const gemini = provider("gemini-test", async () => ({ content: "ok", model: "gemini" }));
    const llm = new FallbackLLMProvider([claude, gemini]);
    await llm.complete([{ role: "user", content: "a" }]);
    await llm.complete([{ role: "user", content: "b" }]);
    expect(claude.calls).toBe(1);
    expect(gemini.calls).toBe(2);
  });
  it("erro passageiro não tira o provedor da fila", async () => {
    const flaky = provider("flaky-test", async () => { throw Object.assign(new Error("high demand"), { status: 503 }); });
    const gemini = provider("gemini-test2", async () => ({ content: "ok", model: "gemini" }));
    const llm = new FallbackLLMProvider([flaky, gemini]);
    await llm.complete([{ role: "user", content: "a" }]);
    await llm.complete([{ role: "user", content: "b" }]);
    expect(flaky.calls).toBe(2);
  });
  it("classifica erros", () => {
    expect(isPermanentProviderError({ status: 401 })).toBe(true);
    expect(isPermanentProviderError(new Error("API key not valid"))).toBe(true);
    expect(isPermanentProviderError({ status: 503, message: "UNAVAILABLE" })).toBe(false);
    expect(isPermanentProviderError({ status: 429, message: "You exceeded your current quota, please check your plan and billing" })).toBe(false);
  });
});
