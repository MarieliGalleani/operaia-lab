const DEFAULT_DENY_KEYS = [
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "authorization",
  "private_key",
  "privatekey",
  "client_secret",
  "webhook_secret",
] as const;

const REDACTED = "[REDACTED]";

/**
 * Remove secrets do payload antes de persistir DomainSignal.payloadJson.
 */
export function redactPayload(
  input: unknown,
  denyKeys: readonly string[] = DEFAULT_DENY_KEYS,
): Record<string, unknown> {
  const deny = new Set(denyKeys.map((key) => key.toLowerCase()));
  const redacted = redactValue(input, deny);
  if (
    redacted !== null &&
    typeof redacted === "object" &&
    !Array.isArray(redacted)
  ) {
    return redacted as Record<string, unknown>;
  }
  return { value: redacted };
}

function redactValue(
  value: unknown,
  deny: ReadonlySet<string>,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, deny));
  }
  if (typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (deny.has(key.toLowerCase())) {
      out[key] = REDACTED;
    } else {
      out[key] = redactValue(child, deny);
    }
  }
  return out;
}

export { DEFAULT_DENY_KEYS, REDACTED };
