/**
 * Replay protection por timestamp skew (complementa unique deliveryId).
 */

export const DEFAULT_REPLAY_SKEW_MS = 5 * 60 * 1000;

export type ReplayCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "replay_skew" };

export function assertTimestampWithinSkew(input: {
  readonly timestampMs: number;
  readonly nowMs?: number;
  readonly skewMs?: number;
}): ReplayCheckResult {
  const now = input.nowMs ?? Date.now();
  const skew = input.skewMs ?? DEFAULT_REPLAY_SKEW_MS;
  if (Math.abs(now - input.timestampMs) > skew) {
    return { ok: false, reason: "replay_skew" };
  }
  return { ok: true };
}
