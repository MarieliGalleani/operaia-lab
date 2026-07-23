import { describe, expect, it } from "vitest";
import { createLLMProvider } from "./providers/create-llm-provider.js";
import { toGeminiRequestParts } from "./providers/gemini-message-adapter.js";

describe("toGeminiRequestParts", () => {
  it("extrai system instruction e mapeia user/assistant", () => {
    const parts = toGeminiRequestParts([
      { role: "system", content: "Voce e a Opera." },
      { role: "user", content: "Status da NEXO?" },
    ]);
    expect(parts.systemInstruction).toBe("Voce e a Opera.");
    expect(parts.contents).toEqual([
      { role: "user", parts: [{ text: "Status da NEXO?" }] },
    ]);
  });

  it("mapeia assistant para model e funde turnos consecutivos", () => {
    const parts = toGeminiRequestParts([
      { role: "user", content: "Oi" },
      { role: "assistant", content: "Ola" },
      { role: "assistant", content: "Como posso ajudar?" },
    ]);
    expect(parts.contents[1]?.role).toBe("model");
    expect(parts.contents[1]?.parts[0]?.text).toContain("Ola");
    expect(parts.contents[1]?.parts[0]?.text).toContain("Como posso ajudar?");
  });
});

describe("createLLMProvider", () => {
  it("cria deterministic para testes", async () => {
    const llm = createLLMProvider({ provider: "deterministic" });
    expect(llm.name).toBe("deterministic");
    const result = await llm.complete([
      { role: "user", content: "plano inicial do workspace" },
    ]);
    expect(result.content).toContain("Analisei o workspace");
  });

  it("exige GEMINI_API_KEY para gemini", () => {
    expect(() =>
      createLLMProvider({ provider: "gemini", geminiApiKey: "" }),
    ).toThrow(/GEMINI_API_KEY/);
  });

  it("reserva slots openai/anthropic/openrouter sem quebrar o contrato", () => {
    expect(() => createLLMProvider({ provider: "openai" })).toThrow(/OpenAI/);
    expect(() => createLLMProvider({ provider: "anthropic" })).toThrow(
      /Anthropic/,
    );
    expect(() => createLLMProvider({ provider: "openrouter" })).toThrow(
      /OpenRouter/,
    );
  });

  it("instancia GeminiProvider quando a chave existe (sem chamar a rede)", () => {
    const llm = createLLMProvider({
      provider: "gemini",
      geminiApiKey: "test-key-not-used-on-construct",
      model: "gemini-2.5-flash",
    });
    expect(llm.name).toBe("gemini");
  });
});
