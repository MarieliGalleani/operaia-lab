/**
 * ContextFingerprint — SHA + arquivos (+ PR/issue) quando disponíveis.
 * Ausência de contexto → fingerprint null → Gate fail-open EXECUTE.
 */
import { createHash } from "node:crypto";
import type {
  ContextFingerprintResult,
  WorkContextHints,
  WorkGovernanceRequest,
} from "./types.js";

export function buildContextFingerprint(
  request: WorkGovernanceRequest,
): ContextFingerprintResult {
  const hints = mergeHintsFromObjective(request);
  const sha = normalizeSha(hints.commitSha);
  const files = normalizeFiles(hints.files);
  const pr = hints.pullRequest?.trim() || null;
  const issue = hints.issue?.trim() || null;

  if (!sha && files.length === 0 && !pr && !issue) {
    return {
      fingerprint: null,
      reason: "insufficient_context",
    };
  }

  const parts = [
    sha ? `sha:${sha}` : "",
    files.length > 0 ? `files:${files.join(",")}` : "",
    pr ? `pr:${pr}` : "",
    issue ? `issue:${issue}` : "",
  ].filter(Boolean);

  return {
    fingerprint: createHash("sha256")
      .update(parts.join("\0"))
      .digest("hex")
      .slice(0, 32),
    reason: sha
      ? files.length > 0
        ? "sha_and_files"
        : "sha_only"
      : files.length > 0
        ? "files_only"
        : pr
          ? "pr_only"
          : "issue_only",
  };
}

export function contextFingerprintsMatch(
  current: string | null,
  prior: string | null,
): boolean {
  if (!current || !prior) {
    return false;
  }
  return current === prior;
}

function mergeHintsFromObjective(
  request: WorkGovernanceRequest,
): WorkContextHints {
  const base = request.contextHints ?? {};
  const fromObj = parseObjectiveHints(request.objective);
  return {
    commitSha: base.commitSha ?? fromObj.commitSha,
    files: base.files?.length ? base.files : fromObj.files,
    pullRequest: base.pullRequest ?? fromObj.pullRequest,
    issue: base.issue ?? fromObj.issue,
    signalId: base.signalId ?? null,
    repository: base.repository ?? fromObj.repository,
    correlationId: base.correlationId ?? request.correlationId ?? null,
  };
}

function parseObjectiveHints(objective: string): WorkContextHints {
  const repo = capture(objective, /repository=([^\s·]+)/i);
  const arquivos = capture(objective, /arquivos=([^·]+?)(?:\s·|$)/i);
  const mudanca = capture(objective, /mudanca=([^·]+?)(?:\s·|$)/i);
  const files =
    arquivos && arquivos !== "n/a"
      ? arquivos
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item && item !== "n/a")
      : [];

  let commitSha: string | null = null;
  if (mudanca?.includes("lastCommitSha")) {
    const shaFromSource = capture(objective, /source=([0-9a-f]{7,40})/i);
    commitSha = shaFromSource;
  }
  const explicitSha = capture(objective, /(?:sha|commit)=([0-9a-f]{7,40})/i);
  if (explicitSha) {
    commitSha = explicitSha;
  }

  return {
    commitSha,
    files,
    pullRequest: capture(objective, /pr[=:]([^\s·]+)/i),
    issue: capture(objective, /issue[=:]([^\s·]+)/i),
    repository: repo,
  };
}

function normalizeSha(sha: string | null | undefined): string | null {
  if (!sha) {
    return null;
  }
  const trimmed = sha.trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeFiles(files: readonly string[] | null | undefined): string[] {
  if (!files?.length) {
    return [];
  }
  return [
    ...new Set(
      files
        .map((file) => file.trim().replace(/\\/g, "/"))
        .filter(Boolean)
        .map((file) => file.toLowerCase()),
    ),
  ].sort();
}

function capture(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}
