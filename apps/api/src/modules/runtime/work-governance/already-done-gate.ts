/**
 * AlreadyDoneGate — autoridade fina de admissão à fila.
 * Na dúvida → EXECUTE. Memory/Learning não decidem.
 *
 * SKIP/REUSE: ledger imediato.
 * EXECUTE: ledger só em `bindExecute` (com missionId) — idempotente por correlationId.
 */
import {
  buildContextFingerprint,
  contextFingerprintsMatch,
} from "./context-fingerprint.js";
import type { WorkGovernanceLedgerPort } from "./decision-ledger.js";
import {
  type GovernanceEvidenceRef,
  type WorkGovernanceAdmitResult,
  type WorkGovernanceDecisionKind,
  type WorkGovernanceDecisionRecord,
  type WorkGovernanceRequest,
} from "./types.js";
import { treeHasValidResult } from "./valid-result.js";
import { buildWorkIdentity } from "./work-identity.js";

export interface PriorMissionLookupPort {
  getMission(
    id: string,
  ): Promise<import("./types.js").GovernanceMissionSnapshot | null>;
  listChildren(
    parentMissionId: string,
  ): Promise<readonly import("./types.js").GovernanceMissionSnapshot[]>;
}

export interface AlreadyDoneGateOptions {
  readonly ledger: WorkGovernanceLedgerPort;
  readonly missions: PriorMissionLookupPort;
}

export class AlreadyDoneGate {
  constructor(private readonly options: AlreadyDoneGateOptions) {}

  /**
   * Avalia admissão. Não materializa missão.
   * Se EXECUTE, caller enfileira e chama `bindExecute`.
   */
  async admit(
    request: WorkGovernanceRequest,
  ): Promise<WorkGovernanceAdmitResult> {
    const correlationId = request.correlationId?.trim() || null;
    if (correlationId) {
      const prior = await this.options.ledger.findByCorrelationId(
        correlationId,
      );
      if (prior) {
        return fromLedger(prior);
      }
    }

    if (request.forceExecute === true) {
      return this.ephemeral(request, {
        decision: "EXECUTE",
        reason: "force_execute_override",
        workIdentity: buildWorkIdentity(request).key || "unsafe",
        contextFingerprint: buildContextFingerprint(request).fingerprint,
        evidences: [{ kind: "force_execute", detail: "true" }],
        persistNow: false,
      });
    }

    const identity = buildWorkIdentity(request);
    if (identity.kind === "unsafe" || !identity.key) {
      return this.ephemeral(request, {
        decision: "EXECUTE",
        reason: `identity_unsafe:${identity.reason}`,
        workIdentity: "unsafe",
        contextFingerprint: buildContextFingerprint(request).fingerprint,
        evidences: [{ kind: "identity", detail: identity.reason }],
        persistNow: false,
      });
    }

    const context = buildContextFingerprint(request);
    if (!context.fingerprint) {
      return this.ephemeral(request, {
        decision: "EXECUTE",
        reason: "insufficient_context",
        workIdentity: identity.key,
        contextFingerprint: null,
        evidences: [{ kind: "context", detail: context.reason }],
        persistNow: false,
      });
    }

    const history = await this.options.ledger.listByWorkIdentity(
      request.workspaceId,
      identity.key,
      20,
    );

    const evidences: GovernanceEvidenceRef[] = [
      { kind: "work_identity", detail: identity.reason },
      { kind: "context", detail: context.reason },
    ];

    for (const entry of history) {
      if (entry.decision !== "EXECUTE" && entry.decision !== "REUSE") {
        continue;
      }
      if (!entry.resultingMissionId) {
        continue;
      }
      evidences.push({
        kind: "ledger_mission",
        id: entry.resultingMissionId,
      });

      const root = await this.options.missions.getMission(
        entry.resultingMissionId,
      );
      if (!root || root.workspaceId !== request.workspaceId) {
        continue;
      }
      if (root.status !== "COMPLETED") {
        continue;
      }

      const children = await this.options.missions.listChildren(root.id);
      if (!treeHasValidResult(root, children, identity.kind)) {
        evidences.push({
          kind: "invalid_or_missing_delivery",
          id: root.id,
        });
        continue;
      }

      if (
        !contextFingerprintsMatch(
          context.fingerprint,
          entry.contextFingerprint,
        )
      ) {
        evidences.push({
          kind: "context_mismatch",
          id: root.id,
          detail: `prior=${entry.contextFingerprint ?? "null"}`,
        });
        continue;
      }

      return this.persist(request, {
        decision: "SKIP",
        reason:
          "valid_completed_result_matching_work_identity_and_context",
        workIdentity: identity.key,
        contextFingerprint: context.fingerprint,
        resultingMissionId: root.id,
        evidences,
      });
    }

    return this.ephemeral(request, {
      decision: "EXECUTE",
      reason:
        history.length === 0
          ? "no_valid_prior_result"
          : "no_matching_valid_result",
      workIdentity: identity.key,
      contextFingerprint: context.fingerprint,
      evidences,
      persistNow: false,
    });
  }

  /**
   * Persiste EXECUTE no ledger com missionId (append-only, idempotente).
   */
  async bindExecute(input: {
    readonly admit: WorkGovernanceAdmitResult;
    readonly request: WorkGovernanceRequest;
    readonly missionId: string;
  }): Promise<WorkGovernanceAdmitResult> {
    if (input.admit.decision !== "EXECUTE") {
      return input.admit;
    }

    const correlationId = input.request.correlationId?.trim() || null;
    if (correlationId) {
      const existing =
        await this.options.ledger.findByCorrelationId(correlationId);
      if (existing) {
        return fromLedger(existing);
      }
    }

    const row = await this.options.ledger.append({
      correlationId,
      workspaceId: input.request.workspaceId,
      source: input.request.source,
      workIdentity: input.admit.workIdentity,
      contextFingerprint: input.admit.contextFingerprint,
      decision: "EXECUTE",
      reason: input.admit.reason,
      resultingMissionId: input.missionId,
      evidences: [
        ...input.admit.evidences,
        { kind: "materialized_mission", id: input.missionId },
      ],
      forceExecute: input.request.forceExecute === true,
    });
    return fromLedger(row);
  }

  private async ephemeral(
    request: WorkGovernanceRequest,
    draft: {
      readonly decision: WorkGovernanceDecisionKind;
      readonly reason: string;
      readonly workIdentity: string;
      readonly contextFingerprint: string | null;
      readonly evidences: readonly GovernanceEvidenceRef[];
      readonly persistNow: boolean;
    },
  ): Promise<WorkGovernanceAdmitResult> {
    if (draft.persistNow) {
      return this.persist(request, {
        ...draft,
        resultingMissionId: null,
      });
    }
    return {
      decision: draft.decision,
      reason: draft.reason,
      workIdentity: draft.workIdentity,
      contextFingerprint: draft.contextFingerprint,
      resultingMissionId: null,
      ledgerId: "pending",
      evidences: draft.evidences,
    };
  }

  private async persist(
    request: WorkGovernanceRequest,
    draft: {
      readonly decision: WorkGovernanceDecisionKind;
      readonly reason: string;
      readonly workIdentity: string;
      readonly contextFingerprint: string | null;
      readonly resultingMissionId: string | null;
      readonly evidences: readonly GovernanceEvidenceRef[];
    },
  ): Promise<WorkGovernanceAdmitResult> {
    const row = await this.options.ledger.append({
      correlationId: request.correlationId,
      workspaceId: request.workspaceId,
      source: request.source,
      workIdentity: draft.workIdentity,
      contextFingerprint: draft.contextFingerprint,
      decision: draft.decision,
      reason: draft.reason,
      resultingMissionId: draft.resultingMissionId,
      evidences: draft.evidences,
      forceExecute: request.forceExecute === true,
    });
    return fromLedger(row);
  }
}

function fromLedger(
  row: WorkGovernanceDecisionRecord,
): WorkGovernanceAdmitResult {
  return {
    decision: row.decision,
    reason: row.reason,
    workIdentity: row.workIdentity,
    contextFingerprint: row.contextFingerprint,
    resultingMissionId: row.resultingMissionId,
    ledgerId: row.id,
    evidences: row.evidences,
  };
}
