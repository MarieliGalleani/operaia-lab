/** Cliente HTTP mínimo para consumir a API real (Fastify, prefixo /api/v1). */
export interface HttpClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

function resolveBaseUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_API_URL ?? "http://localhost:3333/api/v1";
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} em ${response.url}`);
  }
  return (await response.json()) as T;
}

export function createHttpClient(baseUrl: string = resolveBaseUrl()): HttpClient {
  return {
    async get<T>(path: string): Promise<T> {
      return handle<T>(await fetch(`${baseUrl}${path}`));
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      return handle<T>(
        await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
  };
}
