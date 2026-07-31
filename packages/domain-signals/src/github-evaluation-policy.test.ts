import { describe, expect, it } from "vitest";
import {
  decideGitHubEvaluation,
  DomainSignalService,
  InMemoryDomainSignalStore,
} from "./index.js";
import type { DomainSignalRecord, WorkspaceSourceBindingRecord } from "./types.js";

function binding(
  configJson: Record<string, unknown> | null = null,
): WorkspaceSourceBindingRecord {
  const now = new Date();
  return {
    id: "b1",
    workspaceId: "nexo",
    sourceType: "github",
    externalRef: "acme/lab",
    enabled: true,
    configJson,
    secretRef: "env:GITHUB_WEBHOOK_SECRET",
    createdAt: now,
    updatedAt: now,
  };
}

function signal(
  partial: Partial<DomainSignalRecord> & Pick<DomainSignalRecord, "type">,
): DomainSignalRecord {
  const now = new Date();
  return {
    id: "s1",
    workspaceId: "nexo",
    bindingId: "b1",
    sourceType: "github",
    sourceId: "pr:1",
    deliveryId: "d1",
    signalHash: "h1",
    correlationId: "c1",
    status: "DETECTED",
    payloadJson: {},
    metadataJson: null,
    evaluationDecision: null,
    evaluationPolicy: null,
    evaluationReason: null,
    evaluationJson: null,
    evaluatedAt: null,
    missionId: null,
    payloadVersion: 1,
    occurredAt: now,
    receivedAt: now,
    convertedAt: null,
    resolvedAt: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("github-evaluation-policy", () => {
  it("pr.opened → CONVERT_CANDIDATE", () => {
    const decided = decideGitHubEvaluation({
      signal: signal({ type: "github.pr.opened" }),
      binding: binding(),
      similarCount: 0,
    });
    expect(decided.decision).toBe("CONVERT_CANDIDATE");
  });

  it("pr.updated com similares → DEFER", () => {
    const decided = decideGitHubEvaluation({
      signal: signal({ type: "github.pr.updated", sourceId: "pr:9" }),
      binding: binding({ prUpdatedDeferWindowSec: 300 }),
      similarCount: 2,
    });
    expect(decided.decision).toBe("DEFER");
    expect(decided.reason).toBe("deferred_or_ignored_storm");
  });

  it("pr.closed unmerged → IGNORE", () => {
    const decided = decideGitHubEvaluation({
      signal: signal({ type: "github.pr.closed" }),
      binding: binding(),
      similarCount: 0,
    });
    expect(decided.decision).toBe("IGNORE");
    expect(decided.reason).toBe("pr_closed_unmerged");
  });

  it("pr.merged → CONVERT_CANDIDATE (escalate)", () => {
    const decided = decideGitHubEvaluation({
      signal: signal({ type: "github.pr.merged" }),
      binding: binding(),
      similarCount: 0,
    });
    expect(decided.decision).toBe("CONVERT_CANDIDATE");
    expect(decided.reason).toBe("escalate:pr_merged");
  });

  it("applyGitHubEvaluationPolicy persiste IGNORE", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const b = await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: "github",
      externalRef: "acme/lab",
    });
    const created = await signals.ingest({
      workspaceId: "nexo",
      bindingId: b.id,
      sourceType: "github",
      type: "github.pr.closed",
      deliveryId: "del-closed-1",
      payload: { pr: { number: 1 } },
      sourceId: "pr:1",
      externalRef: "acme/lab",
    });
    const { applyGitHubEvaluationPolicy } = await import(
      "./github-evaluation-policy.js"
    );
    const evaluated = await applyGitHubEvaluationPolicy({
      signals,
      signal: created.signal,
      binding: b,
    });
    expect(evaluated.status).toBe("IGNORED");
    expect(evaluated.evaluationDecision).toBe("IGNORE");
  });
});
