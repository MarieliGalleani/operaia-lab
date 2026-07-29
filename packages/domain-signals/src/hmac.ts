import { createHmac, timingSafeEqual } from "node:crypto";

export interface HmacValidationInput {
  readonly rawBody: string | Buffer;
  readonly secret: string;
  readonly signature: string;
  /** Timestamp unix ms do evento (opcional; combina com skew). */
  readonly timestampMs?: number;
  readonly nowMs?: number;
  readonly skewMs?: number;
  readonly algorithm?: "sha256";
}

export type HmacValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "missing_signature" | "invalid_signature" | "replay_skew" | "missing_secret" };

const DEFAULT_SKEW_MS = 5 * 60 * 1000;

/**
 * Validacao HMAC-SHA256 (hook para bridges futuros).
 * Aceita signature com ou sem prefixo "sha256=".
 */
export function verifyHmacSha256(
  input: HmacValidationInput,
): HmacValidationResult {
  if (!input.secret) {
    return { ok: false, reason: "missing_secret" };
  }
  if (!input.signature) {
    return { ok: false, reason: "missing_signature" };
  }

  const skewMs = input.skewMs ?? DEFAULT_SKEW_MS;
  if (input.timestampMs !== undefined) {
    const now = input.nowMs ?? Date.now();
    if (Math.abs(now - input.timestampMs) > skewMs) {
      return { ok: false, reason: "replay_skew" };
    }
  }

  const expected = createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest("hex");
  const provided = normalizeSignature(input.signature);

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "invalid_signature" };
    }
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true };
}

export function signHmacSha256(
  rawBody: string | Buffer,
  secret: string,
): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  if (trimmed.toLowerCase().startsWith("sha256=")) {
    return trimmed.slice("sha256=".length).trim();
  }
  return trimmed;
}
