/**
 * WorkIdentity estável — NÃO substitui objectiveHash (L1).
 * Sem timestamp/UUID/resultado. Se inseguro → kind=unsafe → Gate EXECUTE.
 */
import { createHash } from "node:crypto";
import { parseMissionIntentMarker } from "@operaia/mission-router";
import type {
  WorkGovernanceRequest,
  WorkIdentityResult,
} from "./types.js";

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const ISO_TS_RE =
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/gi;
const LONG_HEX_RE = /\b[0-9a-f]{32,}\b/gi;
const E2E_TAG_RE = /\[E2E-CORE-TEST\]/gi;

export function buildWorkIdentity(
  request: WorkGovernanceRequest,
): WorkIdentityResult {
  const ws = request.workspaceId.trim();
  if (!ws) {
    return { key: "", kind: "unsafe", reason: "missing_workspace" };
  }

  if (request.source === "signal") {
    return buildSignalIdentity(request, ws);
  }

  return buildAssistedOrGenericIdentity(request, ws);
}

function buildSignalIdentity(
  request: WorkGovernanceRequest,
  workspaceId: string,
): WorkIdentityResult {
  const hints = request.contextHints;
  const parsed = parseSignalObjective(request.objective);
  const repository =
    hints?.repository?.trim() ||
    parsed.repository ||
    null;
  const signalType = parsed.signalType || inferSignalType(request.objective);

  if (!repository || repository === "n/a" || !signalType) {
    return {
      key: "",
      kind: "unsafe",
      reason: "signal_identity_incomplete",
    };
  }

  const key = digest([
    "sig",
    workspaceId,
    signalType,
    repository.toLowerCase(),
  ]);
  return {
    key,
    kind: "technical",
    reason: "signal_repo_type",
  };
}

function buildAssistedOrGenericIdentity(
  request: WorkGovernanceRequest,
  workspaceId: string,
): WorkIdentityResult {
  const intent = parseMissionIntentMarker(request.objective);
  if (
    intent &&
    (intent.intentType === "TECH_IMPLEMENTATION" ||
      intent.intentType === "BUG_INVESTIGATION" ||
      intent.intentType === "INFRASTRUCTURE_OPERATION")
  ) {
    const target = normalizeTarget(stripIntentHeader(request.objective));
    if (target.length < 8) {
      return {
        key: "",
        kind: "unsafe",
        reason: "intent_target_too_short",
      };
    }
    const repo = request.contextHints?.repository?.trim().toLowerCase() ?? "";
    const key = digest([
      "intent",
      workspaceId,
      intent.intentType,
      repo,
      target,
    ]);
    return {
      key,
      kind: "technical",
      reason: "mission_intent_technical",
    };
  }

  return {
    key: "",
    kind: "unsafe",
    reason: "identity_not_determinable",
  };
}

/** Remove UUIDs/timestamps/tags de teste — identidade estável. */
export function normalizeTarget(text: string): string {
  return text
    .replace(E2E_TAG_RE, " ")
    .replace(UUID_RE, " ")
    .replace(ISO_TS_RE, " ")
    .replace(LONG_HEX_RE, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stripIntentHeader(objective: string): string {
  return objective.replace(
    /\[MISSION_INTENT\]\s+[A-Z_]+\|employee:[a-z0-9-]+\|confidence:[0-9.]+/i,
    " ",
  );
}

function parseSignalObjective(objective: string): {
  readonly signalType: string | null;
  readonly repository: string | null;
} {
  const typeMatch = /\[COORDINATE\/SIGNAL\]\s+(\S+)/i.exec(objective);
  const repoMatch = /repository=([^\s·]+)/i.exec(objective);
  return {
    signalType: typeMatch?.[1] ?? null,
    repository: repoMatch?.[1] ?? null,
  };
}

function inferSignalType(objective: string): string | null {
  if (/github\.repo\.snapshot\.changed/i.test(objective)) {
    return "github.repo.snapshot.changed";
  }
  if (/github\.push/i.test(objective)) {
    return "github.push";
  }
  return null;
}

function digest(parts: readonly string[]): string {
  return createHash("sha256")
    .update(parts.join("\0"))
    .digest("hex")
    .slice(0, 32);
}
