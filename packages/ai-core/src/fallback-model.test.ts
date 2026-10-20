import { describe, expect, it, vi } from "vitest";

const geminiOptions: Array<{ model?: string }> = [];
vi.mock("./providers/gemini-provider.js", () => ({
  GeminiProvider: class {
    readonly name = "gemini";
    constructor(options: { model?: string }) {
      geminiOptions.push(options);
    }
    async complete() {
      return { content: "ok", model: "gemini-default" };
    }
  },
}));

import { createLLMStack } from "./index.js";

describe("reserva Gemini com primario Claude", () => {
  it("nao repassa o modelo do Claude para o Gemini", () => {
    createLLMStack({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      anthropicApiKey: "test-anthropic",
      geminiApiKey: "test-gemini",
      fallbackProviders: ["gemini", "deterministic"],
      enableConsoleObservability: false,
    });
    expect(geminiOptions).toHaveLength(1);
    expect(geminiOptions[0]!.model).toBeUndefined();
  });
});
