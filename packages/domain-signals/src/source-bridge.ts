/**
 * Contrato SourceBridge — aduana de eventos (S2).
 * Nao persiste, nao cria missao, nao chama fila/matcher/execution.
 */
import type { NormalizedIngressEvent } from "./normalized-ingress.js";

export interface BridgeCapabilities {
  readonly sourceType: string;
  readonly requiresHmac: boolean;
  readonly supportsReplaySkew: boolean;
  readonly supportsRedaction: boolean;
  readonly trustedInternal: boolean;
}

export type BridgeValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "auth_failed"
        | "hmac_failed"
        | "replay_skew"
        | "invalid_context";
      readonly message?: string;
    };

/**
 * Resultado de prepare — pronto para DomainSignalIngestService.
 * Payload ja redigido; sem side-effects de persistencia.
 */
export interface PreparedIngress {
  readonly sourceType: string;
  readonly externalRef: string;
  readonly deliveryId: string;
  readonly type: string;
  readonly sourceId: string | null;
  readonly workspaceId: string;
  readonly correlationId: string | null;
  readonly occurredAt: Date | null;
  readonly payloadRedacted: Record<string, unknown>;
  readonly metadata: Record<string, unknown> | null;
}

export interface SourceBridge {
  readonly sourceType: string;
  readonly capabilities: BridgeCapabilities;

  validateContext(event: NormalizedIngressEvent): BridgeValidationResult;

  /**
   * Hooks de seguranca + redaction.
   * Nao persiste DomainSignal.
   */
  prepare(event: NormalizedIngressEvent): Promise<PreparedIngress>;
}
