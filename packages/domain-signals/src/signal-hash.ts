import { createHash } from "node:crypto";

export interface SignalHashParts {
  readonly workspaceId: string;
  readonly type: string;
  readonly sourceId?: string | null;
  readonly normalizedKey?: string | null;
  readonly relevantPayload?: Record<string, unknown> | null;
}

/**
 * Hash de similaridade (ADR-009).
 * NAO e chave unique — eventos legitimos com hash igual podem coexistir.
 */
export function computeSignalHash(parts: SignalHashParts): string {
  const payloadCanon = parts.relevantPayload
    ? stableStringify(parts.relevantPayload)
    : "";
  const raw = [
    parts.workspaceId,
    parts.type,
    parts.sourceId ?? "",
    parts.normalizedKey ?? "",
    payloadCanon,
  ].join("|");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`;
}
