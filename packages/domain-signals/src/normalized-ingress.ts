/**
 * Contrato de ingresso normalizado (S2 / ADR-009).
 * Antes do DomainSignal — ainda sem persistencia.
 */

export interface InternalAuthContext {
  readonly kind: "internal";
  /** Identificador do caller confiavel (lab, job, service). */
  readonly callerId: string;
  /** Workspace alvo — isolamento obrigatorio. */
  readonly workspaceId: string;
}

/** Auth de ingresso GitHub (S3.1) — workspace resolvido pelo caller via binding. */
export interface GitHubAuthContext {
  readonly kind: "github";
  readonly workspaceId: string;
  readonly deliveryId: string;
}

export type IngressAuthContext = InternalAuthContext | GitHubAuthContext;

export interface IngressHmacContext {
  readonly signature: string;
  readonly rawBody: string | Buffer;
  readonly secret: string;
  readonly timestampMs?: number;
}

/**
 * Evento normalizado entregue a um SourceBridge.
 * workspaceId vem do auth — obrigatorio para binding.
 */
export interface NormalizedIngressEvent {
  readonly sourceType: string;
  readonly externalRef: string;
  readonly deliveryId: string;
  readonly type: string;
  readonly sourceId?: string | null;
  readonly payload: Record<string, unknown>;
  readonly occurredAt?: Date | null;
  readonly correlationId?: string | null;
  readonly auth: IngressAuthContext;
  readonly metadata?: Record<string, unknown> | null;
  /** Presente quando o bridge exige HMAC. */
  readonly hmac?: IngressHmacContext | null;
}

export function workspaceIdFromAuth(auth: IngressAuthContext): string {
  return auth.workspaceId;
}
