/** Cliente HTTP mínimo para consumir a API real (Fastify, prefixo /api/v1). */
export interface HttpClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export interface UnauthorizedResponse {
  readonly status: 401;
  readonly url: string;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} em ${url}`);
    this.name = "HttpError";
  }
}

interface HttpClientOptions {
  readonly notifyUnauthorized?: boolean;
}

let unauthorizedHandler:
  | ((response: UnauthorizedResponse) => void)
  | undefined;

export function setUnauthorizedHandler(
  handler: ((response: UnauthorizedResponse) => void) | undefined,
): void {
  unauthorizedHandler = handler;
}

export function resolveApiV1BaseUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_API_URL ?? "http://localhost:3333/api/v1";
}

export function resolveApiRootUrl(
  apiV1BaseUrl: string = resolveApiV1BaseUrl(),
): string {
  return apiV1BaseUrl.replace(/\/api\/v1\/?$/, "");
}

async function handle<T>(
  response: Response,
  notifyUnauthorized: boolean,
): Promise<T> {
  if (!response.ok) {
    const error = new HttpError(response.status, response.url);
    if (response.status === 401 && notifyUnauthorized) {
      unauthorizedHandler?.({ status: 401, url: response.url });
    }
    throw error;
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function createHttpClient(
  baseUrl: string = resolveApiV1BaseUrl(),
  options: HttpClientOptions = {},
): HttpClient {
  const notifyUnauthorized = options.notifyUnauthorized ?? true;
  return {
    async get<T>(path: string): Promise<T> {
      return handle<T>(
        await fetch(`${baseUrl}${path}`, { credentials: "include" }),
        notifyUnauthorized,
      );
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      return handle<T>(
        await fetch(`${baseUrl}${path}`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        notifyUnauthorized,
      );
    },
  };
}
