/**
 * Mapeamento GitHub webhook → tipo tipado do sinal (contrato S3.0 / S3.1).
 * Puro: sem persistencia, sem fila, sem Prisma.
 */
import {
  severityForGitHubSignalType,
  type SignalSeverity,
} from "./signal-severity.js";

export const GITHUB_SOURCE_TYPE = "github" as const;

export interface GitHubBindingConfig {
  readonly pushBranches?: readonly string[];
  readonly ignoreDraftPr?: boolean;
  readonly botDenyLogins?: readonly string[];
  readonly issueLabelAllowlist?: readonly string[];
}

export interface GitHubMappedSignal {
  readonly type: string;
  readonly sourceId: string;
  readonly externalRef: string;
  readonly severity: SignalSeverity;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: Date | null;
  readonly githubEvent: string;
  readonly githubAction: string | null;
}

export type GitHubMapResult =
  | { readonly kind: "mapped"; readonly signal: GitHubMappedSignal }
  | { readonly kind: "ignore"; readonly reason: string; readonly githubEvent: string };

const DEFAULT_PUSH_BRANCHES = ["main", "master"] as const;

/**
 * Mapeia corpo JSON ja parseado + nome do evento GitHub.
 */
export function mapGitHubWebhookEvent(input: {
  readonly githubEvent: string;
  readonly body: Record<string, unknown>;
  readonly config?: GitHubBindingConfig | null;
}): GitHubMapResult {
  const event = input.githubEvent.trim().toLowerCase();
  const body = input.body;
  const config = input.config ?? {};

  if (event === "ping") {
    return { kind: "ignore", reason: "health_ping", githubEvent: event };
  }

  const repo = asRecord(body.repository);
  if (!repo) {
    return { kind: "ignore", reason: "missing_repository", githubEvent: event };
  }

  const ownerLogin =
    asString(asRecord(repo.owner)?.login) ??
    asString(repo.owner) ??
    "";
  const repoName = asString(repo.name) ?? "";
  if (!ownerLogin || !repoName) {
    return { kind: "ignore", reason: "invalid_repository", githubEvent: event };
  }

  const externalRef = `${ownerLogin}/${repoName}`.toLowerCase();
  const defaultBranch = asString(repo.default_branch) ?? "main";
  const senderLogin = asString(asRecord(body.sender)?.login) ?? "";

  if (
    senderLogin &&
    (config.botDenyLogins ?? []).some(
      (bot) => bot.toLowerCase() === senderLogin.toLowerCase(),
    )
  ) {
    return { kind: "ignore", reason: "bot_denied", githubEvent: event };
  }

  const action = asString(body.action);

  if (event === "pull_request") {
    return mapPullRequest({
      body,
      action,
      externalRef,
      ownerLogin,
      repoName,
      defaultBranch,
      githubEvent: event,
      ignoreDraftPr: config.ignoreDraftPr !== false,
    });
  }

  if (event === "issues") {
    return mapIssue({
      body,
      action,
      externalRef,
      ownerLogin,
      repoName,
      defaultBranch,
      githubEvent: event,
      labelAllowlist: config.issueLabelAllowlist,
    });
  }

  if (event === "push") {
    return mapPush({
      body,
      externalRef,
      ownerLogin,
      repoName,
      defaultBranch,
      githubEvent: event,
      pushBranches: config.pushBranches ?? DEFAULT_PUSH_BRANCHES,
    });
  }

  return { kind: "ignore", reason: "unmapped_event", githubEvent: event };
}

function mapPullRequest(input: {
  readonly body: Record<string, unknown>;
  readonly action: string | null;
  readonly externalRef: string;
  readonly ownerLogin: string;
  readonly repoName: string;
  readonly defaultBranch: string;
  readonly githubEvent: string;
  readonly ignoreDraftPr: boolean;
}): GitHubMapResult {
  const pr = asRecord(input.body.pull_request);
  if (!pr) {
    return {
      kind: "ignore",
      reason: "missing_pull_request",
      githubEvent: input.githubEvent,
    };
  }

  const number = asNumber(pr.number);
  if (number === null) {
    return {
      kind: "ignore",
      reason: "invalid_pr_number",
      githubEvent: input.githubEvent,
    };
  }

  const draft = Boolean(pr.draft);
  const merged = Boolean(pr.merged);
  const action = input.action;

  let type: string | null = null;
  if (
    action === "opened" ||
    action === "reopened" ||
    action === "ready_for_review"
  ) {
    if (input.ignoreDraftPr && draft && action !== "ready_for_review") {
      return {
        kind: "ignore",
        reason: "draft_pr",
        githubEvent: input.githubEvent,
      };
    }
    type = "github.pr.opened";
  } else if (action === "synchronize") {
    type = "github.pr.updated";
  } else if (action === "closed") {
    type = merged ? "github.pr.merged" : "github.pr.closed";
  } else {
    return {
      kind: "ignore",
      reason: "unmapped_event",
      githubEvent: input.githubEvent,
    };
  }

  const author =
    asString(asRecord(pr.user)?.login) ??
    asString(asRecord(input.body.sender)?.login) ??
    "";

  const payload = {
    repository: {
      owner: input.ownerLogin,
      repository: input.repoName,
      defaultBranch: input.defaultBranch,
    },
    pullRequest: {
      number,
      state: asString(pr.state) ?? (merged || action === "closed" ? "closed" : "open"),
      author,
      targetBranch: asString(asRecord(pr.base)?.ref) ?? "",
      sourceBranch: asString(asRecord(pr.head)?.ref) ?? "",
    },
  };

  return {
    kind: "mapped",
    signal: {
      type,
      sourceId: `pr:${number}`,
      externalRef: input.externalRef,
      severity: severityForGitHubSignalType(type),
      payload,
      occurredAt: parseDate(pr.updated_at) ?? parseDate(pr.created_at),
      githubEvent: input.githubEvent,
      githubAction: action,
    },
  };
}

function mapIssue(input: {
  readonly body: Record<string, unknown>;
  readonly action: string | null;
  readonly externalRef: string;
  readonly ownerLogin: string;
  readonly repoName: string;
  readonly defaultBranch: string;
  readonly githubEvent: string;
  readonly labelAllowlist?: readonly string[];
}): GitHubMapResult {
  const issue = asRecord(input.body.issue);
  if (!issue) {
    return {
      kind: "ignore",
      reason: "missing_issue",
      githubEvent: input.githubEvent,
    };
  }

  const number = asNumber(issue.number);
  if (number === null) {
    return {
      kind: "ignore",
      reason: "invalid_issue_number",
      githubEvent: input.githubEvent,
    };
  }

  const action = input.action;
  let type: string | null = null;
  if (action === "opened" || action === "reopened") {
    type = "github.issue.opened";
  } else if (action === "labeled") {
    type = "github.issue.labeled";
  } else if (action === "closed") {
    type = "github.issue.closed";
  } else {
    return {
      kind: "ignore",
      reason: "unmapped_event",
      githubEvent: input.githubEvent,
    };
  }

  const labels = extractLabelNames(issue.labels);
  if (type === "github.issue.labeled" && input.labelAllowlist?.length) {
    const added = asString(asRecord(input.body.label)?.name);
    const allow = new Set(
      input.labelAllowlist.map((label) => label.toLowerCase()),
    );
    if (!added || !allow.has(added.toLowerCase())) {
      return {
        kind: "ignore",
        reason: "label_not_allowlisted",
        githubEvent: input.githubEvent,
      };
    }
  }

  const payload = {
    repository: {
      owner: input.ownerLogin,
      repository: input.repoName,
      defaultBranch: input.defaultBranch,
    },
    issue: {
      number,
      labels,
    },
  };

  return {
    kind: "mapped",
    signal: {
      type,
      sourceId: `issue:${number}`,
      externalRef: input.externalRef,
      severity: severityForGitHubSignalType(type),
      payload,
      occurredAt: parseDate(issue.updated_at) ?? parseDate(issue.created_at),
      githubEvent: input.githubEvent,
      githubAction: action,
    },
  };
}

function mapPush(input: {
  readonly body: Record<string, unknown>;
  readonly externalRef: string;
  readonly ownerLogin: string;
  readonly repoName: string;
  readonly defaultBranch: string;
  readonly githubEvent: string;
  readonly pushBranches: readonly string[];
}): GitHubMapResult {
  const ref = asString(input.body.ref) ?? "";
  if (!ref.startsWith("refs/heads/")) {
    return {
      kind: "ignore",
      reason: "push_not_branch",
      githubEvent: input.githubEvent,
    };
  }

  const branch = ref.slice("refs/heads/".length);
  const allow = new Set(
    input.pushBranches.map((item) => item.toLowerCase()),
  );
  if (!allow.has(branch.toLowerCase())) {
    return {
      kind: "ignore",
      reason: "branch_not_allowlisted",
      githubEvent: input.githubEvent,
    };
  }

  const commits = Array.isArray(input.body.commits) ? input.body.commits : [];
  const after = asString(input.body.after) ?? "";
  const afterShort = after.slice(0, 7) || "unknown";
  const type = "github.push";

  const payload = {
    repository: {
      owner: input.ownerLogin,
      repository: input.repoName,
      defaultBranch: input.defaultBranch,
    },
    push: {
      branch,
      commitCount: commits.length,
    },
  };

  return {
    kind: "mapped",
    signal: {
      type,
      sourceId: `push:${ref}:${afterShort}`,
      externalRef: input.externalRef,
      severity: severityForGitHubSignalType(type),
      payload,
      occurredAt: parseDate(asRecord(input.body.head_commit)?.timestamp) ?? null,
      githubEvent: input.githubEvent,
      githubAction: null,
    },
  };
}

function extractLabelNames(labels: unknown): string[] {
  if (!Array.isArray(labels)) {
    return [];
  }
  const names: string[] = [];
  for (const item of labels) {
    if (typeof item === "string") {
      names.push(item);
      continue;
    }
    const name = asString(asRecord(item)?.name);
    if (name) {
      names.push(name);
    }
  }
  return names;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
