/**
 * DomainSignalIngestService — S2.
 * Bridge → hooks → binding → redact → DomainSignalService.ingest → Opera context.
 * Nao enfileira missao. Signal informa. Opera decide. Mission executa.
 */
import type { BridgeRegistry } from "./bridge-registry.js";
import type { DomainSignalService } from "./domain-signal-service.js";
import {
  emitIngestObservation,
  type IngestObserver,
  type IngestRejectionReason,
} from "./ingest-observability.js";
import type { NormalizedIngressEvent } from "./normalized-ingress.js";
import { workspaceIdFromAuth } from "./normalized-ingress.js";
import type {
  DomainSignalRecord,
  IngestResultKind,
  OperaEvaluationContext,
} from "./types.js";

export class DomainSignalIngestError extends Error {
  readonly code = "DOMAIN_SIGNAL_INGEST_REJECTED" as const;

  constructor(
    readonly rejectionReason: IngestRejectionReason,
    message?: string,
  ) {
    super(message ?? `Ingest rejeitado: ${rejectionReason}`);
    this.name = "DomainSignalIngestError";
  }
}

export interface DomainSignalIngestSuccess {
  readonly signal: DomainSignalRecord;
  readonly evaluationContext: OperaEvaluationContext;
  readonly ingestResult: IngestResultKind;
}

export interface DomainSignalIngestServiceOptions {
  readonly registry: BridgeRegistry;
  readonly signals: DomainSignalService;
  readonly observer?: IngestObserver;
}

export class DomainSignalIngestService {
  private readonly registry: BridgeRegistry;
  private readonly signals: DomainSignalService;
  private readonly observer: IngestObserver | undefined;

  constructor(options: DomainSignalIngestServiceOptions) {
    this.registry = options.registry;
    this.signals = options.signals;
    this.observer = options.observer;
  }

  async ingest(
    event: NormalizedIngressEvent,
  ): Promise<DomainSignalIngestSuccess> {
    const workspaceId = safeWorkspace(event);
    const deliveryId = event.deliveryId ?? null;
    const sourceType = event.sourceType ?? "unknown";

    const bridge = this.registry.get(event.sourceType);
    if (!bridge) {
      this.reject(event, workspaceId, deliveryId, "unknown_bridge");
      throw new DomainSignalIngestError("unknown_bridge");
    }

    const validation = bridge.validateContext(event);
    if (!validation.ok) {
      const reason = mapValidationReason(validation.reason);
      this.reject(event, workspaceId, deliveryId, reason);
      throw new DomainSignalIngestError(reason, validation.message);
    }

    const prepared = await bridge.prepare(event);

    const binding = await this.signals.findBinding({
      workspaceId: prepared.workspaceId,
      sourceType: prepared.sourceType,
      externalRef: prepared.externalRef,
    });

    if (!binding) {
      this.reject(
        event,
        prepared.workspaceId,
        prepared.deliveryId,
        "binding_missing",
        prepared.correlationId,
      );
      throw new DomainSignalIngestError("binding_missing");
    }

    if (!binding.enabled) {
      this.reject(
        event,
        prepared.workspaceId,
        prepared.deliveryId,
        "binding_disabled",
        prepared.correlationId,
      );
      throw new DomainSignalIngestError("binding_disabled");
    }

    if (binding.workspaceId !== prepared.workspaceId) {
      this.reject(
        event,
        prepared.workspaceId,
        prepared.deliveryId,
        "binding_missing",
        prepared.correlationId,
      );
      throw new DomainSignalIngestError(
        "binding_missing",
        "binding workspace diverge (isolamento)",
      );
    }

    const ingestResult = await this.signals.ingest({
      workspaceId: prepared.workspaceId,
      bindingId: binding.id,
      sourceType: prepared.sourceType,
      type: prepared.type,
      deliveryId: prepared.deliveryId,
      sourceId: prepared.sourceId,
      externalRef: prepared.externalRef,
      correlationId: prepared.correlationId,
      payload: prepared.payloadRedacted,
      metadata: prepared.metadata,
      occurredAt: prepared.occurredAt,
    });

    const evaluationContext = await this.signals.getOperaEvaluationContext(
      ingestResult.signal.id,
    );

    const obsResult =
      ingestResult.kind === "duplicate_delivery"
        ? "duplicate_delivery"
        : "accepted";

    emitIngestObservation(this.observer, {
      sourceType,
      correlationId:
        ingestResult.signal.correlationId ?? prepared.correlationId,
      workspaceId: prepared.workspaceId,
      deliveryId: prepared.deliveryId,
      result: obsResult,
      signalId: ingestResult.signal.id,
      ingestResult: ingestResult.kind,
      githubEvent: metaString(event.metadata, "githubEvent"),
      repository: metaString(event.metadata, "repository") ?? prepared.externalRef,
      severity: metaString(event.metadata, "severity"),
    });

    return {
      signal: ingestResult.signal,
      evaluationContext,
      ingestResult: ingestResult.kind,
    };
  }

  private reject(
    event: NormalizedIngressEvent,
    workspaceId: string | null,
    deliveryId: string | null,
    reason: IngestRejectionReason,
    correlationId?: string | null,
  ): void {
    emitIngestObservation(this.observer, {
      sourceType: event.sourceType ?? "unknown",
      correlationId: correlationId ?? event.correlationId ?? null,
      workspaceId,
      deliveryId,
      result: "rejected",
      rejectionReason: reason,
      signalId: null,
      githubEvent: metaString(event.metadata, "githubEvent"),
      repository: metaString(event.metadata, "repository"),
      severity: metaString(event.metadata, "severity"),
    });
  }
}

function safeWorkspace(event: NormalizedIngressEvent): string | null {
  try {
    return workspaceIdFromAuth(event.auth);
  } catch {
    return null;
  }
}

function mapValidationReason(
  reason: "auth_failed" | "hmac_failed" | "replay_skew" | "invalid_context",
): IngestRejectionReason {
  return reason;
}

function metaString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}
