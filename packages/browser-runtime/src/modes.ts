/**
 * Modos operacionais do browser-runtime.
 * Nao misturar: VM usa HEADLESS_READONLY; GUI usa MANUAL_AUTH.
 */
export const BrowserMode = {
  /** VM sem DISPLAY — producao read-only, sem senha/sessao. */
  HEADLESS_READONLY: "HEADLESS_READONLY",
  /** Maquina com GUI — login digitado pela usuaria; nao rodar na VM. */
  MANUAL_AUTH: "MANUAL_AUTH",
} as const;

export type BrowserMode = (typeof BrowserMode)[keyof typeof BrowserMode];

export function resolveBrowserMode(): BrowserMode {
  if (process.env.OPERAIA_BROWSER_MANUAL === "1") {
    return BrowserMode.MANUAL_AUTH;
  }
  return BrowserMode.HEADLESS_READONLY;
}

export function isManualAuthMode(): boolean {
  return resolveBrowserMode() === BrowserMode.MANUAL_AUTH;
}
