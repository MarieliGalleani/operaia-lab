/**
 * TavilyWebSearchAdapter — implementa WebSearchTool via API da Tavily
 * (feita para agentes de IA: resultados ja limpos, sem precisar de
 * scraping proprio). Desacoplado do Employee Runtime.
 */
import { ToolErrorCode, toolError } from "../../result.js";
import { ToolId } from "../../tool-id.js";
import { toolFail, toolOk, type ToolResult } from "../../tool-result.js";
import type { WebSearchInput, WebSearchResult, WebSearchTool } from "../../tools.js";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_RESULTS = 10;
const DEFAULT_RESULTS = 5;

export interface TavilyWebSearchAdapterOptions {
  readonly apiKey: string;
  readonly employeeId?: string;
  /** Injetavel pra teste; default = fetch global. */
  readonly fetchImpl?: typeof fetch;
}

interface TavilyApiResult {
  readonly title?: string;
  readonly url?: string;
  readonly content?: string;
}

interface TavilyApiResponse {
  readonly results?: readonly TavilyApiResult[];
}

export class TavilyWebSearchAdapter implements WebSearchTool {
  private readonly apiKey: string;
  private readonly employeeId?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TavilyWebSearchAdapterOptions) {
    this.apiKey = options.apiKey;
    this.employeeId = options.employeeId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(input: WebSearchInput): Promise<ToolResult<WebSearchResult>> {
    const query = input.query?.trim();
    if (!query) {
      return toolFail(
        toolError({
          code: ToolErrorCode.INVALID_INPUT,
          message: "webSearch exige query nao vazia",
          toolId: ToolId.webSearch,
          employeeId: this.employeeId,
        }),
      );
    }

    const maxResults = Math.min(
      Math.max(input.maxResults ?? DEFAULT_RESULTS, 1),
      MAX_RESULTS,
    );

    let response: Response;
    try {
      response = await this.fetchImpl(TAVILY_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          max_results: maxResults,
        }),
      });
    } catch (error) {
      return toolFail(
        toolError({
          code: ToolErrorCode.NETWORK,
          message:
            error instanceof Error ? error.message : "falha de rede na busca",
          toolId: ToolId.webSearch,
          employeeId: this.employeeId,
        }),
      );
    }

    if (!response.ok) {
      const code =
        response.status === 401 || response.status === 403
          ? ToolErrorCode.UNAUTHORIZED
          : response.status === 429
            ? ToolErrorCode.RATE_LIMIT
            : ToolErrorCode.UNAVAILABLE;
      return toolFail(
        toolError({
          code,
          message: `Tavily respondeu ${response.status}`,
          toolId: ToolId.webSearch,
          employeeId: this.employeeId,
        }),
      );
    }

    const body = (await response.json()) as TavilyApiResponse;
    const results = (body.results ?? []).map((hit) => ({
      title: hit.title ?? "",
      url: hit.url ?? "",
      snippet: hit.content ?? "",
    }));

    return toolOk({ query, results });
  }
}

export function createWebSearchToolPorts(
  options: TavilyWebSearchAdapterOptions,
): { readonly webSearch: WebSearchTool } {
  return { webSearch: new TavilyWebSearchAdapter(options) };
}
