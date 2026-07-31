/**
 * Regras de decisao para github.repo.snapshot.changed.
 * Pura / sem I/O — usada pela policy GitHub e pelo Signal Decision Engine.
 */
import type { GitHubPolicyDecision } from "./github-evaluation-policy.js";

const CRITICAL_LABELS = new Set([
  "critical",
  "urgent",
  "p0",
  "severity:critical",
  "severity/critical",
  "sev0",
  "sev-0",
]);

/** Paths claramente tecnicos (CONVERT). */
export function isTechnicalPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const lower = normalized.toLowerCase();
  if (/(^|\/)src\//.test(lower) || lower.startsWith("src/")) {
    return true;
  }
  if (/(^|\/)package\.json$/.test(lower)) {
    return true;
  }
  if (
    /(^|\/)migrations?\//.test(lower) ||
    lower.includes("/prisma/migrations/") ||
    /(^|\/)prisma\/migrations\//.test(lower)
  ) {
    return true;
  }
  return false;
}

/** README ou docs sem impacto tecnico. */
export function isReadmeOrDocsPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const lower = normalized.toLowerCase();
  const base = lower.split("/").pop() ?? lower;
  if (/^readme(\.[a-z0-9]+)?$/.test(base)) {
    return true;
  }
  if (lower.startsWith("docs/") || lower.startsWith("doc/")) {
    return true;
  }
  if (
    base === "license" ||
    base === "license.md" ||
    base === "changelog.md" ||
    base === "contributing.md" ||
    base === "code_of_conduct.md"
  ) {
    return true;
  }
  // markdown generico fora de src/migrations
  if (base.endsWith(".md") && !isTechnicalPath(lower)) {
    return true;
  }
  return false;
}

export function isCriticalIssueLabel(label: string): boolean {
  return CRITICAL_LABELS.has(label.trim().toLowerCase());
}

export interface GithubSnapshotDecisionPayload {
  readonly affectedFiles?: readonly string[];
  readonly changeFields?: readonly string[];
  readonly openPullRequestsCount?: number;
  readonly openIssuesCount?: number;
  readonly hasCriticalIssue?: boolean;
  readonly issueLabels?: readonly string[];
  readonly previous?: {
    readonly openPullRequestsCount?: number | null;
    readonly openIssuesCount?: number | null;
  } | null;
}

/**
 * Decide IGNORE | DEFER | CONVERT_CANDIDATE para snapshot operacional.
 */
export function decideGithubRepoSnapshotChanged(
  payload: Record<string, unknown> | GithubSnapshotDecisionPayload,
): GitHubPolicyDecision {
  const p = normalizePayload(payload);
  const changeFields = new Set(p.changeFields ?? []);
  const files = p.affectedFiles ?? [];

  const prIncreased =
    changeFields.has("openPullRequestsCount") &&
    typeof p.openPullRequestsCount === "number" &&
    p.openPullRequestsCount > (p.previous?.openPullRequestsCount ?? 0);

  if (prIncreased || (changeFields.has("openPullRequestsCount") &&
    (p.openPullRequestsCount ?? 0) > 0 &&
    (p.previous?.openPullRequestsCount ?? 0) < (p.openPullRequestsCount ?? 0))) {
    return {
      decision: "CONVERT_CANDIDATE",
      reason: "pr_open_delta",
      inputs: {
        openPullRequestsCount: p.openPullRequestsCount,
        previousOpenPullRequestsCount: p.previous?.openPullRequestsCount ?? null,
      },
    };
  }

  // PR aberto detectado no snapshot (count > 0 e campo mudou, ou flag explicita)
  if (
    changeFields.has("openPullRequestsCount") &&
    (p.openPullRequestsCount ?? 0) > 0
  ) {
    return {
      decision: "CONVERT_CANDIDATE",
      reason: "pr_open_delta",
      inputs: { openPullRequestsCount: p.openPullRequestsCount },
    };
  }

  const labels = p.issueLabels ?? [];
  const criticalLabel = labels.find((label) => isCriticalIssueLabel(label));
  if (p.hasCriticalIssue === true || criticalLabel) {
    return {
      decision: "CONVERT_CANDIDATE",
      reason: "critical_issue",
      inputs: {
        hasCriticalIssue: p.hasCriticalIssue === true,
        label: criticalLabel ?? null,
      },
    };
  }

  if (files.length > 0) {
    const technical = files.filter((file) => isTechnicalPath(file));
    if (technical.length > 0) {
      return {
        decision: "CONVERT_CANDIDATE",
        reason: "technical_file_change",
        inputs: {
          affectedFiles: [...files],
          technicalFiles: technical,
        },
      };
    }

    const allNonTechnical = files.every((file) => isReadmeOrDocsPath(file));
    if (allNonTechnical) {
      const readmeOnly = files.every((file) => {
        const base =
          file.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
        return /^readme(\.[a-z0-9]+)?$/.test(base);
      });
      return {
        decision: "IGNORE",
        reason: readmeOnly ? "readme_only" : "no_technical_impact",
        inputs: { affectedFiles: [...files] },
      };
    }

    // arquivos presentes mas nenhum tecnico nem so-docs → impacto incerto
    return {
      decision: "IGNORE",
      reason: "no_technical_impact",
      inputs: { affectedFiles: [...files] },
    };
  }

  // Commit mudou sem lista de arquivos → DEFER (Opera pode reavaliar depois)
  if (changeFields.has("lastCommitSha")) {
    return {
      decision: "DEFER",
      reason: "commit_changed_files_unknown",
      inputs: { changeFields: [...changeFields] },
    };
  }

  // so language / updatedAt / defaultBranch sem sinal tecnico
  return {
    decision: "IGNORE",
    reason: "no_technical_impact",
    inputs: { changeFields: [...changeFields] },
  };
}

function normalizePayload(
  payload: Record<string, unknown> | GithubSnapshotDecisionPayload,
): GithubSnapshotDecisionPayload {
  const raw = payload as Record<string, unknown>;
  const previousRaw = asRecord(raw.previous);
  return {
    affectedFiles: asStringArray(raw.affectedFiles),
    changeFields: asStringArray(raw.changeFields),
    openPullRequestsCount: asNumber(raw.openPullRequestsCount),
    openIssuesCount: asNumber(raw.openIssuesCount),
    hasCriticalIssue:
      typeof raw.hasCriticalIssue === "boolean"
        ? raw.hasCriticalIssue
        : undefined,
    issueLabels: asStringArray(raw.issueLabels),
    previous: previousRaw
      ? {
          openPullRequestsCount: asNumber(previousRaw.openPullRequestsCount),
          openIssuesCount: asNumber(previousRaw.openIssuesCount),
        }
      : null,
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

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
