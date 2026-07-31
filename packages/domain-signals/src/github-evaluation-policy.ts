/**
 * Decision Policy GitHub (contrato S3.0 §6).
 * Decide CONVERT_CANDIDATE | IGNORE | DEFER apos DETECTED.
 *
 * Nota: o enum Prisma nao tem ESCALATE — handoff urgente para a Opera
 * usa CONVERT_CANDIDATE com reason `escalate:*` (reuso do contrato existente).
 */
import type { DomainSignalService } from "./domain-signal-service.js";
import type { GitHubBindingConfig } from "./github-event-mapper.js";
import { decideGithubRepoSnapshotChanged } from "./github-snapshot-decision.js";
import type {
  DomainSignalEvaluationDecision,
  DomainSignalRecord,
  WorkspaceSourceBindingRecord,
} from "./types.js";

export const GITHUB_EVALUATION_POLICY = "github-default@2" as const;

export interface GitHubPolicyDecision {
  readonly decision: DomainSignalEvaluationDecision;
  readonly reason: string;
  readonly inputs?: Record<string, unknown>;
}

export interface ApplyGitHubEvaluationPolicyInput {
  readonly signals: DomainSignalService;
  readonly signal: DomainSignalRecord;
  readonly binding: WorkspaceSourceBindingRecord;
  readonly nowMs?: number;
}

/**
 * Aplica a tabela de politica GitHub e persiste via DomainSignalService.evaluate.
 */
export async function applyGitHubEvaluationPolicy(
  input: ApplyGitHubEvaluationPolicyInput,
): Promise<DomainSignalRecord> {
  if (input.signal.status !== "DETECTED") {
    return input.signal;
  }

  const decided = decideGitHubEvaluation({
    signal: input.signal,
    binding: input.binding,
    nowMs: input.nowMs,
    similarCount: await countSimilar(input),
  });

  return input.signals.evaluate({
    signalId: input.signal.id,
    decision: decided.decision,
    policy: GITHUB_EVALUATION_POLICY,
    reason: decided.reason,
    inputs: decided.inputs,
    includeSimilar: true,
  });
}

export function decideGitHubEvaluation(input: {
  readonly signal: DomainSignalRecord;
  readonly binding: WorkspaceSourceBindingRecord;
  readonly nowMs?: number;
  readonly similarCount: number;
}): GitHubPolicyDecision {
  const config = parseConfig(input.binding.configJson);
  const type = input.signal.type;
  const payload = input.signal.payloadJson;

  if (type === "github.pr.closed") {
    const ignoreUnmerged = config.ignoreUnmergedClose !== false;
    if (ignoreUnmerged) {
      return {
        decision: "IGNORE",
        reason: "pr_closed_unmerged",
        inputs: { type },
      };
    }
  }

  if (type === "github.issue.closed") {
    const ignoreClosed = config.ignoreIssueClosed !== false;
    if (ignoreClosed) {
      return {
        decision: "IGNORE",
        reason: "issue_closed",
        inputs: { type },
      };
    }
  }

  if (type === "github.issue.labeled") {
    const allow = config.issueLabelAllowlist ?? [];
    const labels =
      asStringArray(asRecord(payload.issue)?.labels) ??
      asStringArray(payload.labels) ??
      [];
    if (allow.length === 0) {
      return {
        decision: "IGNORE",
        reason: "label_not_allowlisted",
        inputs: { labels, allowlist: allow },
      };
    }
    const matched = labels.find((label) =>
      allow.some((item) => item.toLowerCase() === label.toLowerCase()),
    );
    if (!matched) {
      return {
        decision: "IGNORE",
        reason: "label_not_allowlisted",
        inputs: { labels, allowlist: allow },
      };
    }
    return {
      decision: "CONVERT_CANDIDATE",
      reason: "issue_labeled_allowlisted",
      inputs: { label: matched },
    };
  }

  if (type === "github.pr.updated") {
    const windowSec = config.prUpdatedDeferWindowSec ?? 300;
    if (input.similarCount > 0 && windowSec > 0) {
      return {
        decision: "DEFER",
        reason: "deferred_or_ignored_storm",
        inputs: {
          similarCount: input.similarCount,
          prUpdatedDeferWindowSec: windowSec,
        },
      };
    }
    return {
      decision: "CONVERT_CANDIDATE",
      reason: "pr_updated_candidate",
      inputs: { similarCount: input.similarCount },
    };
  }

  if (type === "github.pr.merged") {
    // ESCALATE operacional ≡ CONVERT_CANDIDATE (handoff urgente a Opera).
    return {
      decision: "CONVERT_CANDIDATE",
      reason: "escalate:pr_merged",
      inputs: { type },
    };
  }

  if (
    type === "github.pr.opened" ||
    type === "github.issue.opened" ||
    type === "github.push"
  ) {
    return {
      decision: "CONVERT_CANDIDATE",
      reason: `${type.replace(/\./g, "_")}_candidate`,
      inputs: { type },
    };
  }

  if (type === "github.repo.snapshot.changed") {
    return decideGithubRepoSnapshotChanged(payload);
  }

  return {
    decision: "IGNORE",
    reason: "unmapped_evaluation_type",
    inputs: { type },
  };
}

async function countSimilar(
  input: ApplyGitHubEvaluationPolicyInput,
): Promise<number> {
  const similar = await input.signals.getOperaEvaluationContext(
    input.signal.id,
  );
  const windowSec =
    parseConfig(input.binding.configJson).prUpdatedDeferWindowSec ?? 300;
  if (windowSec <= 0) {
    return similar.similarSignalIds.length;
  }
  // getOperaEvaluationContext so retorna ids; similaridade recente
  // ja esta no hash — count > 0 implica storm no mesmo sourceId/type.
  return similar.similarSignalIds.length;
}

export type GitHubEvaluationConfig = GitHubBindingConfig & {
  readonly ignoreUnmergedClose?: boolean;
  readonly ignoreIssueClosed?: boolean;
  readonly prUpdatedDeferWindowSec?: number;
};

function parseConfig(
  configJson: Record<string, unknown> | null,
): GitHubEvaluationConfig {
  if (!configJson) {
    return {};
  }
  return {
    pushBranches: asStringArray(configJson.pushBranches),
    issueLabelAllowlist: asStringArray(configJson.issueLabelAllowlist),
    ignoreDraftPr:
      typeof configJson.ignoreDraftPr === "boolean"
        ? configJson.ignoreDraftPr
        : undefined,
    ignoreUnmergedClose:
      typeof configJson.ignoreUnmergedClose === "boolean"
        ? configJson.ignoreUnmergedClose
        : undefined,
    ignoreIssueClosed:
      typeof configJson.ignoreIssueClosed === "boolean"
        ? configJson.ignoreIssueClosed
        : undefined,
    botDenyLogins: asStringArray(configJson.botDenyLogins),
    prUpdatedDeferWindowSec:
      typeof configJson.prUpdatedDeferWindowSec === "number"
        ? configJson.prUpdatedDeferWindowSec
        : undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string");
}
