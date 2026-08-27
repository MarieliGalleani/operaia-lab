/**
 * Sanitizacao de console/network para evidence — nunca senha/cookies/tokens.
 */
const SENSITIVE =
  /(password|passwd|senha|cookie|authorization|bearer\s+[a-z0-9._-]+|token|secret|api[_-]?key)/i;

export function sanitizeConsoleText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  if (SENSITIVE.test(trimmed)) {
    return "[redacted-sensitive]";
  }
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
}

export function isSensitiveHeaderName(name: string): boolean {
  return /^(cookie|set-cookie|authorization|x-api-key)$/i.test(name);
}

export function summarizeNetworkFailure(input: {
  readonly url: string;
  readonly status?: number;
  readonly statusText?: string;
}): { readonly host: string; readonly path: string; readonly status: number | null } | null {
  try {
    const url = new URL(input.url);
    return {
      host: url.hostname,
      path: url.pathname,
      status: input.status ?? null,
    };
  } catch {
    return null;
  }
}
