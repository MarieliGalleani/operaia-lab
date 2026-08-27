/**
 * Allowlist de hosts — Playwright so pode navegar nestes dominios.
 */
export const BROWSER_ALLOWED_HOSTS = [
  "lab.operaia.com.br",
  "api.operaia.com.br",
] as const;

export type BrowserAllowedHost = (typeof BROWSER_ALLOWED_HOSTS)[number];

export function isAllowedBrowserUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }
    return (BROWSER_ALLOWED_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}

export function assertAllowedBrowserUrl(rawUrl: string): void {
  if (!isAllowedBrowserUrl(rawUrl)) {
    throw new Error(
      `URL fora da allowlist de browser: ${rawUrl} (permitidos: ${BROWSER_ALLOWED_HOSTS.join(", ")})`,
    );
  }
}
