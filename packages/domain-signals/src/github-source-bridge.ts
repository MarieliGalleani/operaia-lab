/**
 * GitHubSourceBridge (S3.1) — primeiro conector externo.
 * Produz apenas NormalizedIngressEvent. Nao acessa ledger/Prisma/fila.
 *
 * Signal informa. Opera decide. Mission executa.
 */
import { randomUUID } from "node:crypto";
import {
  GITHUB_SOURCE_TYPE,
  mapGitHubWebhookEvent,
  type GitHubBindingConfig,
  type GitHubMapResult,
} from "./github-event-mapper.js";
import { verifyHmacSha256, signHmacSha256 } from "./hmac.js";
import {
  emitIngestObservation,
  type IngestObserver,
  type IngestRejectionReason,
} from "./ingest-observability.js";
import type { NormalizedIngressEvent } from "./normalized-ingress.js";
import { redactPayload } from "./redact.js";
import { assertTimestampWithinSkew } from "./replay.js";
import type {
  BridgeCapabilities,
  BridgeValidationResult,
  PreparedIngress,
  SourceBridge,
} from "./source-bridge.js";

export interface GitHubWebhookIngressInput {
  readonly rawBody: string | Buffer;
  /** Header X-Hub-Signature-256 */
  readonly signature256: string;
  /** Header X-GitHub-Delivery */
  readonly deliveryId: string;
  /** Header X-GitHub-Event */
  readonly githubEvent: string;
  readonly webhookSecret: string;
  /** Workspace alvo (resolvido via WorkspaceSourceBinding pelo caller). */
  readonly workspaceId: string;
  readonly correlationId?: string | null;
  readonly config?: GitHubBindingConfig | null;
  readonly nowMs?: number;
  readonly skewMs?: number;
}

export type GitHubAcceptResult =
  | {
      readonly kind: "accepted";
      readonly event: NormalizedIngressEvent;
      readonly severity: string;
      readonly githubEvent: string;
      readonly repository: string;
    }
  | {
      readonly kind: "ignored";
      readonly reason: string;
      readonly githubEvent: string;
    }
  | {
      readonly kind: "rejected";
      readonly reason: IngestRejectionReason;
      readonly githubEvent: string;
      readonly message?: string;
    };

export interface GitHubSourceBridgeOptions {
  readonly observer?: IngestObserver;
}

export class GitHubSourceBridge implements SourceBridge {
  readonly sourceType = GITHUB_SOURCE_TYPE;

  readonly capabilities: BridgeCapabilities = {
    sourceType: GITHUB_SOURCE_TYPE,
    requiresHmac: true,
    supportsReplaySkew: true,
    supportsRedaction: true,
    trustedInternal: false,
  };

  private readonly observer: IngestObserver | undefined;

  constructor(options: GitHubSourceBridgeOptions = {}) {
    this.observer = options.observer;
  }

  /**
   * Entrada tipica de webhook GitHub (sem HTTP neste MVP).
   * Nao persiste; nao chama ingest.
   */
  acceptWebhook(input: GitHubWebhookIngressInput): GitHubAcceptResult {
    const githubEvent = input.githubEvent?.trim() || "unknown";

    if (!input.workspaceId?.trim()) {
      return this.reject(input, githubEvent, "auth_failed", "workspaceId ausente");
    }
    if (!input.deliveryId?.trim()) {
      return this.reject(
        input,
        githubEvent,
        "invalid_context",
        "X-GitHub-Delivery ausente",
      );
    }
    if (!input.webhookSecret) {
      return this.reject(input, githubEvent, "hmac_failed", "webhook secret ausente");
    }

    const hmac = verifyHmacSha256({
      rawBody: input.rawBody,
      secret: input.webhookSecret,
      signature: input.signature256,
      nowMs: input.nowMs,
      skewMs: input.skewMs,
    });
    if (!hmac.ok) {
      const reason: IngestRejectionReason =
        hmac.reason === "replay_skew" ? "replay_skew" : "hmac_failed";
      return this.reject(input, githubEvent, reason, hmac.reason);
    }

    let body: Record<string, unknown>;
    try {
      const text =
        typeof input.rawBody === "string"
          ? input.rawBody
          : input.rawBody.toString("utf8");
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return this.reject(
        input,
        githubEvent,
        "invalid_context",
        "JSON invalido",
      );
    }

    const mapped = mapGitHubWebhookEvent({
      githubEvent,
      body,
      config: input.config,
    });

    if (mapped.kind === "ignore") {
      emitIngestObservation(this.observer, {
        sourceType: GITHUB_SOURCE_TYPE,
        correlationId: input.correlationId ?? null,
        workspaceId: input.workspaceId,
        deliveryId: input.deliveryId,
        result: "rejected",
        rejectionReason: "invalid_context",
        signalId: null,
        githubEvent: mapped.githubEvent,
        repository: null,
        severity: null,
        mapIgnoreReason: mapped.reason,
      });
      return {
        kind: "ignored",
        reason: mapped.reason,
        githubEvent: mapped.githubEvent,
      };
    }

    if (mapped.signal.occurredAt) {
      const skew = assertTimestampWithinSkew({
        timestampMs: mapped.signal.occurredAt.getTime(),
        nowMs: input.nowMs,
        skewMs: input.skewMs,
      });
      if (!skew.ok) {
        return this.reject(input, githubEvent, "replay_skew", "occurredAt skew");
      }
    }

    const event = this.toNormalizedEvent(input, mapped);
    emitIngestObservation(this.observer, {
      sourceType: GITHUB_SOURCE_TYPE,
      correlationId: event.correlationId ?? null,
      workspaceId: input.workspaceId,
      deliveryId: input.deliveryId,
      result: "accepted",
      signalId: null,
      githubEvent: mapped.signal.githubEvent,
      repository: mapped.signal.externalRef,
      severity: mapped.signal.severity,
    });

    return {
      kind: "accepted",
      event,
      severity: mapped.signal.severity,
      githubEvent: mapped.signal.githubEvent,
      repository: mapped.signal.externalRef,
    };
  }

  validateContext(event: NormalizedIngressEvent): BridgeValidationResult {
    if (event.sourceType !== GITHUB_SOURCE_TYPE) {
      return {
        ok: false,
        reason: "invalid_context",
        message: `GitHubSourceBridge espera sourceType=github`,
      };
    }
    if (event.auth.kind !== "github") {
      return { ok: false, reason: "auth_failed", message: "auth.kind != github" };
    }
    if (!event.auth.workspaceId?.trim()) {
      return { ok: false, reason: "auth_failed", message: "workspaceId ausente" };
    }
    if (!event.deliveryId?.trim()) {
      return {
        ok: false,
        reason: "invalid_context",
        message: "deliveryId ausente",
      };
    }
    if (!event.hmac) {
      return { ok: false, reason: "hmac_failed", message: "hmac ausente" };
    }

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
        `GitHubSourceBridge.prepare: ${validation.reason}${validation.message ? ` — ${validation.message}` : ""}`,
      );
    }
    if (event.auth.kind !== "github") {
      throw new Error("GitHubSourceBridge.prepare exige auth.kind=github");
    }

    return {
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: event.externalRef,
      deliveryId: event.deliveryId,
      type: event.type,
      sourceId: event.sourceId ?? null,
      workspaceId: event.auth.workspaceId,
      correlationId: event.correlationId?.trim() || null,
      occurredAt: event.occurredAt ?? null,
      payloadRedacted: redactPayload(event.payload),
      metadata: event.metadata ?? null,
    };
  }

  private toNormalizedEvent(
    input: GitHubWebhookIngressInput,
    mapped: Extract<GitHubMapResult, { kind: "mapped" }>,
  ): NormalizedIngressEvent {
    const signal = mapped.signal;
    const correlationId =
      input.correlationId?.trim() || randomUUID();

    return {
      sourceType: GITHUB_SOURCE_TYPE,
      externalRef: signal.externalRef,
      deliveryId: input.deliveryId,
      type: signal.type,
      sourceId: signal.sourceId,
      payload: redactPayload(signal.payload),
      occurredAt: signal.occurredAt,
      correlationId,
      auth: {
        kind: "github",
        workspaceId: input.workspaceId,
        deliveryId: input.deliveryId,
      },
      metadata: {
        severity: signal.severity,
        githubEvent: signal.githubEvent,
        githubAction: signal.githubAction,
        repository: signal.externalRef,
      },
      hmac: {
        signature: input.signature256,
        rawBody: input.rawBody,
        secret: input.webhookSecret,
        timestampMs: signal.occurredAt?.getTime(),
      },
    };
  }

  private reject(
    input: GitHubWebhookIngressInput,
    githubEvent: string,
    reason: IngestRejectionReason,
    message?: string,
  ): Extract<GitHubAcceptResult, { kind: "rejected" }> {
    emitIngestObservation(this.observer, {
      sourceType: GITHUB_SOURCE_TYPE,
      correlationId: input.correlationId ?? null,
      workspaceId: input.workspaceId ?? null,
      deliveryId: input.deliveryId ?? null,
      result: "rejected",
      rejectionReason: reason,
      signalId: null,
      githubEvent,
      repository: null,
      severity: null,
    });
    return { kind: "rejected", reason, githubEvent, message };
  }
}

/** Helper de teste: assina body como GitHub (sha256=...). */
export function signGitHubWebhookBody(
  rawBody: string | Buffer,
  secret: string,
): string {
  return `sha256=${signHmacSha256(rawBody, secret)}`;
}
