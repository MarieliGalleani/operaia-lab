/**
 * Work Governance Gate (AlreadyDoneGate) — tipos do contrato de admissão.
 * Memory/Learning não são autoridade; este Gate decide SKIP/REUSE/REOPEN/EXECUTE.
 */

export type WorkGovernanceSource = "assisted" | "signal" | "supervisor";

export type WorkGovernanceDecisionKind =
  | "SKIP"
  | "REUSE"
  | "REOPEN"
  | "EXECUTE";

export type WorkIdentityKind =
  | "technical"
  | "generic"
  | "finance"
  | "ux"
  | "marketing"
  | "unsafe";

export interface WorkContextHints {
  readonly commitSha?: string | null;
  readonly files?: readonly string[] | null;
  readonly pullRequest?: string | null;
  readonly issue?: string | null;
  readonly signalId?: string | null;
  readonly repository?: string | null;
  readonly correlationId?: string | null;
}

export interface WorkGovernanceRequest {
  readonly workspaceId: string;
  readonly objective: string;
  readonly source: WorkGovernanceSource;
  /** COORDINATE | EXECUTE — tipicamente COORDINATE na admissão. */
  readonly missionKind: string;
  readonly contextHints?: WorkContextHints;
  readonly specialization?: string | null;
  readonly forceExecute?: boolean;
  readonly correlationId?: string | null;
}

export interface WorkIdentityResult {
  /** Chave estável; vazia se unsafe. */
  readonly key: string;
  readonly kind: WorkIdentityKind;
  readonly reason: string;
}

export interface ContextFingerprintResult {
  /** null = contexto insuficiente para comparar (fail-open). */
  readonly fingerprint: string | null;
  readonly reason: string;
}

export interface GovernanceEvidenceRef {
  readonly kind: string;
  readonly id?: string;
  readonly detail?: string;
}

export interface WorkGovernanceDecisionRecord {
  readonly id: string;
  readonly correlationId: string | null;
  readonly workspaceId: string;
  readonly source: WorkGovernanceSource;
  readonly workIdentity: string;
  readonly contextFingerprint: string | null;
  readonly decision: WorkGovernanceDecisionKind;
  readonly reason: string;
  readonly authority: string;
  readonly resultingMissionId: string | null;
  readonly evidences: readonly GovernanceEvidenceRef[];
  readonly forceExecute: boolean;
  readonly createdAt: Date;
}

export interface WorkGovernanceAdmitResult {
  readonly decision: WorkGovernanceDecisionKind;
  readonly reason: string;
  readonly workIdentity: string;
  readonly contextFingerprint: string | null;
  readonly resultingMissionId: string | null;
  readonly ledgerId: string;
  readonly evidences: readonly GovernanceEvidenceRef[];
}

/** Snapshot mínimo de missão para ValidResult (sem acoplar Prisma no core). */
export interface GovernanceMissionSnapshot {
  readonly id: string;
  readonly workspaceId: string;
  readonly status: string;
  readonly missionKind: string;
  readonly objective: string;
  readonly resultJson: unknown;
  readonly parentMissionId: string | null;
}

export const WORK_GOVERNANCE_AUTHORITY = "AlreadyDoneGate" as const;
