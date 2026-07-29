/**
 * InternalSourceBridge — unico bridge S2.
 * Aceita eventos internos autenticados; nao e webhook publico.
 */
import { randomUUID } from "node:crypto";
import type { NormalizedIngressEvent } from "./normalized-ingress.js";
import { workspaceIdFromAuth } from "./normalized-ingress.js";
import { redactPayload } from "./redact.js";
import { assertTimestampWithinSkew } from "./replay.js";
import { verifyHmacSha256 } from "./hmac.js";
import type {
  BridgeCapabilities,
  BridgeValidationResult,
  PreparedIngress,
  SourceBridge,
} from "./source-bridge.js";

export const INTERNAL_SOURCE_TYPE = "internal" as const;

export class InternalSourceBridge implements SourceBridge {
  readonly sourceType = INTERNAL_SOURCE_TYPE;

  readonly capabilities: BridgeCapabilities = {
    sourceType: INTERNAL_SOURCE_TYPE,
    requiresHmac: false,
    supportsReplaySkew: true,
    supportsRedaction: true,
    trustedInternal: true,
  };

  validateContext(event: NormalizedIngressEvent): BridgeValidationResult {
    if (event.sourceType !== INTERNAL_SOURCE_TYPE) {
      return {
        ok: false,
        reason: "invalid_context",
        message: `InternalSourceBridge espera sourceType=internal (recebeu ${event.sourceType})`,
      };
    }
    if (event.auth.kind !== "internal") {
      return { ok: false, reason: "auth_failed", message: "auth.kind invalido" };
    }
    if (!event.auth.callerId?.trim()) {
      return { ok: false, reason: "auth_failed", message: "callerId ausente" };
    }
    if (!event.auth.workspaceId?.trim()) {
      return {
        ok: false,
        reason: "auth_failed",
        message: "workspaceId ausente no auth",
      };
    }
    if (!event.externalRef?.trim()) {
      return {
        ok: false,
        reason: "invalid_context",
        message: "externalRef ausente",
      };
    }
    if (!event.deliveryId?.trim()) {
      return {
        ok: false,
        reason: "invalid_context",
        message: "deliveryId ausente",
      };
    }
    if (!event.type?.trim()) {
      return {
        ok: false,
        reason: "invalid_context",
        message: "type ausente",
      };
    }

    if (event.hmac) {
      const hmac = verifyHmacSha256({
        rawBody: event.hmac.rawBody,
        secret: event.hmac.secret,
        signature: event.hmac.signature,
        timestampMs: event.hmac.timestampMs,
      });
      if (!hmac.ok) {
        return {
          ok: false,
          reason: hmac.reason === "replay_skew" ? "replay_skew" : "hmac_failed",
          message: hmac.reason,
        };
      }
    }

    if (event.occurredAt) {
      const skew = assertTimestampWithinSkew({
        timestampMs: event.occurredAt.getTime(),
      });
      if (!skew.ok) {
        return { ok: false, reason: "replay_skew" };
      }
    }

    return { ok: true };
  }

  async prepare(event: NormalizedIngressEvent): Promise<PreparedIngress> {
    const validation = this.validateContext(event);
    if (!validation.ok) {
      throw new Error(
        `InternalSourceBridge.prepare: ${validation.reason}${validation.message ? ` — ${validation.message}` : ""}`,
      );
    }

    return {
      sourceType: INTERNAL_SOURCE_TYPE,
      externalRef: event.externalRef,
      deliveryId: event.deliveryId,
      type: event.type,
      sourceId: event.sourceId ?? null,
      workspaceId: workspaceIdFromAuth(event.auth),
      correlationId: event.correlationId?.trim() || null,
      occurredAt: event.occurredAt ?? null,
      payloadRedacted: redactPayload(event.payload),
      metadata: event.metadata ?? null,
    };
  }
}

/** Helper de teste / lab: monta evento interno minimo. */
export function buildInternalIngressEvent(input: {
  readonly workspaceId: string;
  readonly externalRef: string;
  readonly deliveryId: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly callerId?: string;
  readonly sourceId?: string | null;
  readonly correlationId?: string | null;
  readonly occurredAt?: Date | null;
  readonly metadata?: Record<string, unknown> | null;
}): NormalizedIngressEvent {
  return {
    sourceType: INTERNAL_SOURCE_TYPE,
    externalRef: input.externalRef,
    deliveryId: input.deliveryId,
    type: input.type,
    sourceId: input.sourceId,
    payload: input.payload,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    auth: {
      kind: "internal",
      callerId: input.callerId ?? `caller-${randomUUID().slice(0, 8)}`,
      workspaceId: input.workspaceId,
    },
    metadata: input.metadata,
  };
}
