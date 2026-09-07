import { describe, expect, it, vi } from "vitest";
import { ToolErrorCode } from "../../index.js";
import { TavilyWebSearchAdapter } from "./tavily-web-search-adapter.js";

function createMockFetch(
  status: number,
  body: unknown,
): { fetchImpl: typeof fetch; calls: unknown[] } {
  const calls: unknown[] = [];
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push(init?.body);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("TavilyWebSearchAdapter", () => {
  it("retorna resultados mapeados em caso de sucesso", async () => {
    const { fetchImpl } = createMockFetch(200, {
      results: [
        { title: "OpenAI", url: "https://openai.com", content: "resumo" },
      ],
    });
    const adapter = new TavilyWebSearchAdapter({ apiKey: "k", fetchImpl });

    const result = await adapter.execute({ query: "openai" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.query).toBe("openai");
      expect(result.data.results).toEqual([
        { title: "OpenAI", url: "https://openai.com", snippet: "resumo" },
      ]);
    }
  });

  it("query vazia falha com INVALID_INPUT sem chamar a rede", async () => {
    const { fetchImpl } = createMockFetch(200, { results: [] });
    const adapter = new TavilyWebSearchAdapter({ apiKey: "k", fetchImpl });

    const result = await adapter.execute({ query: "   " });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ToolErrorCode.INVALID_INPUT);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("401 vira UNAUTHORIZED", async () => {
    const { fetchImpl } = createMockFetch(401, { error: "bad key" });
    const adapter = new TavilyWebSearchAdapter({ apiKey: "k", fetchImpl });

    const result = await adapter.execute({ query: "openai" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ToolErrorCode.UNAUTHORIZED);
    }
  });

  it("429 vira RATE_LIMIT", async () => {
    const { fetchImpl } = createMockFetch(429, { error: "slow down" });
    const adapter = new TavilyWebSearchAdapter({ apiKey: "k", fetchImpl });

    const result = await adapter.execute({ query: "openai" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ToolErrorCode.RATE_LIMIT);
    }
  });

  it("limita maxResults a 10 mesmo se pedirem mais", async () => {
    const { fetchImpl, calls } = createMockFetch(200, { results: [] });
    const adapter = new TavilyWebSearchAdapter({ apiKey: "k", fetchImpl });

    await adapter.execute({ query: "openai", maxResults: 50 });

    const sentBody = JSON.parse(calls[0] as string);
    expect(sentBody.max_results).toBe(10);
  });
});
