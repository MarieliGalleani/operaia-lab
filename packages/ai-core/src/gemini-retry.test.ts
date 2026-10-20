import { describe, expect, it, vi } from "vitest";

const calls = { n: 0 };
const script: Array<"503" | "400" | "ok"> = [];
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async () => {
        calls.n += 1;
        const step = script.shift() ?? "ok";
        if (step === "503") throw Object.assign(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'), { status: 503 });
        if (step === "400") throw Object.assign(new Error("bad request"), { status: 400 });
        return { text: "ok", usageMetadata: undefined };
      },
    };
  },
}));

import { GeminiProvider, isTransientGeminiError } from "./providers/gemini-provider.js";

describe("Gemini tenta de novo em erro passageiro", () => {
  it("503 seguido de sucesso responde", async () => {
    calls.n = 0;
    script.splice(0, script.length, "503", "ok");
    const p = new GeminiProvider({ apiKey: "k", retryDelaysMs: [0, 0] });
    const r = await p.complete([{ role: "user", content: "oi" }]);
    expect(r.content).toBe("ok");
    expect(calls.n).toBe(2);
  });
  it("erro 400 não repete", async () => {
    calls.n = 0;
    script.splice(0, script.length, "400");
    const p = new GeminiProvider({ apiKey: "k", retryDelaysMs: [0, 0] });
    await expect(p.complete([{ role: "user", content: "oi" }])).rejects.toThrow("bad request");
    expect(calls.n).toBe(1);
  });
  it("desiste depois das tentativas", async () => {
    calls.n = 0;
    script.splice(0, script.length, "503", "503", "503");
    const p = new GeminiProvider({ apiKey: "k", retryDelaysMs: [0, 0] });
    await expect(p.complete([{ role: "user", content: "oi" }])).rejects.toThrow();
    expect(calls.n).toBe(3);
  });
  it("classifica erros", () => {
    expect(isTransientGeminiError({ status: 429 })).toBe(true);
    expect(isTransientGeminiError(new Error("This model is currently experiencing high demand"))).toBe(true);
    expect(isTransientGeminiError({ status: 401 })).toBe(false);
  });
});
