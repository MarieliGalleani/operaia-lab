/**
 * Transporte HTTP GitHub — unico cliente de leitura do OperaIA.lab.
 * Usado pelo GitHubToolAdapter e pelo scanner (FetchGithubRepoClient).
 * Nao criar outro cliente HTTP GitHub em paralelo.
 */
import { ToolErrorCode, type ToolErrorCode as ToolErrorCodeType } from "../../result.js";

export interface GithubApiClientOptions {
  readonly token?: string | null;
  readonly fetchImpl?: typeof fetch;
  readonly baseUrl?: string;
  readonly userAgent?: string;
}

export interface GithubApiErrorShape {
  readonly code: ToolErrorCodeType;
  readonly message: string;
  readonly status?: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class GithubApiRequestError extends Error {
  readonly shape: GithubApiErrorShape;

  constructor(shape: GithubApiErrorShape) {
    super(shape.message);
    this.name = "GithubApiRequestError";
    this.shape = shape;
  }
}

export class GithubApiClient {
  private readonly token: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(options: GithubApiClientOptions = {}) {
    this.token = options.token?.trim() || null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://api.github.com").replace(
      /\/$/,
      "",
    );
    this.userAgent = options.userAgent ?? "operaia-lab-github-tools";
  }

  get hasToken(): boolean {
    return Boolean(this.token);
  }

  async getJson(path: string): Promise<unknown> {
    const response = await this.request(path);
    return this.parseJson(response, path);
  }

  async getJsonWithHeaders(
    path: string,
  ): Promise<{ readonly body: unknown; readonly headers: Headers }> {
    const response = await this.request(path);
    const body = await this.parseJson(response, path);
    return { body, headers: response.headers };
  }

  async request(path: string): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": this.userAgent,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, { headers });
    } catch (error) {
      throw new GithubApiRequestError({
        code: ToolErrorCode.NETWORK,
        message:
          error instanceof Error
            ? error.message
            : "Falha de rede ao chamar GitHub",
        details: { path },
      });
    }
  }

  private async parseJson(response: Response, path: string): Promise<unknown> {
    if (response.ok) {
      if (response.status === 204) {
        return null;
      }
      return response.json();
    }

    const remaining = response.headers.get("x-ratelimit-remaining");
    const code = mapHttpStatus(response.status, remaining);
    let message = `GitHub ${path}: HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (typeof body.message === "string" && body.message.trim()) {
        message = body.message;
      }
    } catch {
      // ignore body parse
    }

    throw new GithubApiRequestError({
      code,
      message,
      status: response.status,
      details: { path, remaining },
    });
  }
}

export function mapHttpStatus(
  status: number,
  rateLimitRemaining: string | null,
): ToolErrorCodeType {
  if (status === 404) {
    return ToolErrorCode.NOT_FOUND;
  }
  if (status === 401) {
    return ToolErrorCode.UNAUTHORIZED;
  }
  if (status === 403) {
    if (rateLimitRemaining === "0") {
      return ToolErrorCode.RATE_LIMIT;
    }
    return ToolErrorCode.FORBIDDEN;
  }
  if (status === 429) {
    return ToolErrorCode.RATE_LIMIT;
  }
  return ToolErrorCode.UNKNOWN;
}

export function parseOwnerRepo(repository: string): {
  readonly owner: string;
  readonly repo: string;
  readonly fullName: string;
} {
  const normalized = repository.trim().toLowerCase();
  const [owner, repo] = normalized.split("/");
  if (!owner || !repo) {
    throw new GithubApiRequestError({
      code: ToolErrorCode.INVALID_INPUT,
      message: `repository invalido: ${repository}`,
    });
  }
  return { owner, repo, fullName: `${owner}/${repo}` };
}

/** Extrai page=N de rel="last" no Link header do GitHub. */
export function parseLastPage(linkHeader: string | null): number | null {
  if (!linkHeader?.trim()) {
    return null;
  }
  const parts = linkHeader.split(",");
  for (const part of parts) {
    if (!/rel="last"/i.test(part)) {
      continue;
    }
    const match = part.match(/[?&]page=(\d+)/);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10);
    }
  }
  return null;
}
