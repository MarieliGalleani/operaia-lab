/**
 * Contratos Domain Signal Layer (ADR-009 / S1).
 * Sem dependencia da fila oficial, Matcher ou ExecutionEngine.
 */

export const DOMAIN_SIGNAL_STATUSES = [
  "DETECTED",
  "EVALUATED",
  "CONVERTED",
  "RESOLVED",
  "IGNORED",
  "EXPIRED",
] as const;

export type DomainSignalStatus = (typeof DOMAIN_SIGNAL_STATUSES)[number];

export const DOMAIN_SIGNAL_EVALUATION_DECISIONS = [
  "CONVERT_CANDIDATE",
  "IGNORE",
  "DEFER",
] as const;

export type DomainSignalEvaluationDecision =
  (typeof DOMAIN_SIGNAL_EVALUATION_DECISIONS)[number];

export const OPEN_SIGNAL_STATUSES: readonly DomainSignalStatus[] = [
  "DETECTED",
  "EVALUATED",
] as const;

export interface WorkspaceSourceBindingRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceType: string;
  readonly externalRef: string;
  readonly enabled: boolean;
  readonly configJson: Record<string, unknown> | null;
  readonly secretRef: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DomainSignalRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly bindingId: string | null;
  readonly sourceType: string;
  readonly sourceId: string | null;
  readonly type: string;
  readonly deliveryId: string;
  readonly signalHash: string;
  readonly correlationId: string;
  readonly status: DomainSignalStatus;
  readonly payloadJson: Record<string, unknown>;
  readonly metadataJson: Record<string, unknown> | null;
  readonly evaluationDecision: DomainSignalEvaluationDecision | null;
  readonly evaluationPolicy: string | null;
  readonly evaluationReason: string | null;
  readonly evaluationJson: Record<string, unknown> | null;
  readonly evaluatedAt: Date | null;
  readonly missionId: string | null;
  readonly payloadVersion: number;
  readonly occurredAt: Date | null;
  readonly receivedAt: Date;
  readonly convertedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Snapshot auditavel da avaliacao. */
export interface EvaluationAudit {
  readonly decision: DomainSignalEvaluationDecision;
  readonly policy: string;
  readonly reason: string;
  readonly appliedAt: string;
  readonly inputs?: Record<string, unknown>;
  readonly similarSignalIds?: readonly string[];
}

/** Contexto sanitizado para a Opera decidir (sem executar). */
export interface OperaEvaluationContext {
  readonly signalId: string;
  readonly workspaceId: string;
  readonly correlationId: string;
  readonly sourceType: string;
  readonly type: string;
  readonly sourceId: string | null;
  readonly deliveryId: string;
  readonly signalHash: string;
  readonly status: DomainSignalStatus;
  readonly payload: Record<string, unknown>;
  readonly evaluation: EvaluationAudit | null;
  readonly similarSignalIds: readonly string[];
  readonly missionId: string | null;
}

export interface IngestSignalInput {
  readonly workspaceId: string;
  readonly sourceType: string;
  readonly type: string;
  readonly deliveryId: string;
  readonly payload: Record<string, unknown>;
  readonly sourceId?: string | null;
  readonly bindingId?: string | null;
  readonly externalRef?: string | null;
  readonly correlationId?: string | null;
  readonly signalHash?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly occurredAt?: Date | null;
  readonly expiresAt?: Date | null;
  readonly payloadVersion?: number;
}

export type IngestResultKind = "created" | "duplicate_delivery";

export interface IngestSignalResult {
  readonly kind: IngestResultKind;
  readonly signal: DomainSignalRecord;
}

export interface EvaluateSignalInput {
  readonly signalId: string;
  readonly decision: DomainSignalEvaluationDecision;
  readonly policy: string;
  readonly reason: string;
  readonly inputs?: Record<string, unknown>;
  /** Se true, inclui similares por signalHash no audit (nao bloqueia). */
  readonly includeSimilar?: boolean;
}

export interface UpsertBindingInput {
  readonly workspaceId: string;
  readonly sourceType: string;
  readonly externalRef: string;
  readonly enabled?: boolean;
  readonly configJson?: Record<string, unknown> | null;
  readonly secretRef?: string | null;
}
