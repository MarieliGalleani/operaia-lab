/**
 * Resolve WorkspaceSourceBinding.secretRef → secret em claro.
 * Secrets nunca vivem em configJson.
 *
 * Formatos suportados:
 * - null/empty → env.GITHUB_WEBHOOK_SECRET (default)
 * - "env:VAR_NAME" → process.env[VAR_NAME]
 * - "VAR_NAME" → process.env[VAR_NAME] (atalho)
 */
export function resolveWebhookSecret(
  secretRef: string | null | undefined,
  envMap: Record<string, string | undefined> = process.env,
  fallbackEnvKey = "GITHUB_WEBHOOK_SECRET",
): string | null {
  const ref = secretRef?.trim();
  if (!ref) {
    const fallback = envMap[fallbackEnvKey]?.trim();
    return fallback || null;
  }

  const envKey = ref.startsWith("env:") ? ref.slice(4).trim() : ref;
  if (!envKey) {
    return null;
  }
  const value = envMap[envKey]?.trim();
  return value || null;
}
