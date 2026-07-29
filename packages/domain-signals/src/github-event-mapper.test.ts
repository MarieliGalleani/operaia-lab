import { describe, expect, it } from "vitest";
import { mapGitHubWebhookEvent } from "./github-event-mapper.js";
import { severityForGitHubSignalType } from "./signal-severity.js";

function repoBody(extra: Record<string, unknown> = {}) {
  return {
    repository: {
      name: "operaia-lab",
      full_name: "acme/operaia-lab",
      default_branch: "main",
      owner: { login: "acme" },
    },
    sender: { login: "dev" },
    ...extra,
  };
}

describe("mapGitHubWebhookEvent — MVP", () => {
  it("pull_request opened → github.pr.opened MEDIUM", () => {
    const result = mapGitHubWebhookEvent({
      githubEvent: "pull_request",
      body: repoBody({
        action: "opened",
        pull_request: {
          number: 12,
          state: "open",
          draft: false,
          merged: false,
          user: { login: "dev" },
          base: { ref: "main" },
          head: { ref: "feat" },
          updated_at: new Date().toISOString(),
        },
      }),
    });
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.signal.type).toBe("github.pr.opened");
      expect(result.signal.sourceId).toBe("pr:12");
      expect(result.signal.severity).toBe("MEDIUM");
      expect(result.signal.payload.pullRequest).toMatchObject({
        number: 12,
        author: "dev",
        targetBranch: "main",
        sourceBranch: "feat",
      });
      expect(result.signal.payload).not.toHaveProperty("body");
    }
  });

  it("pull_request synchronize → github.pr.updated LOW", () => {
    const result = mapGitHubWebhookEvent({
      githubEvent: "pull_request",
      body: repoBody({
        action: "synchronize",
        pull_request: {
          number: 12,
          state: "open",
          draft: false,
          merged: false,
          user: { login: "dev" },
          base: { ref: "main" },
          head: { ref: "feat" },
        },
      }),
    });
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.signal.type).toBe("github.pr.updated");
      expect(result.signal.severity).toBe("LOW");
    }
  });

  it("pull_request closed merged/unmerged", () => {
    const merged = mapGitHubWebhookEvent({
      githubEvent: "pull_request",
      body: repoBody({
        action: "closed",
        pull_request: {
          number: 3,
          state: "closed",
          draft: false,
          merged: true,
          user: { login: "dev" },
          base: { ref: "main" },
          head: { ref: "feat" },
        },
      }),
    });
    const closed = mapGitHubWebhookEvent({
      githubEvent: "pull_request",
      body: repoBody({
        action: "closed",
        pull_request: {
          number: 4,
          state: "closed",
          draft: false,
          merged: false,
          user: { login: "dev" },
          base: { ref: "main" },
          head: { ref: "feat" },
        },
      }),
    });
    expect(merged.kind === "mapped" && merged.signal.type).toBe(
      "github.pr.merged",
    );
    expect(closed.kind === "mapped" && closed.signal.type).toBe(
      "github.pr.closed",
    );
  });

  it("ignora draft opened", () => {
    const result = mapGitHubWebhookEvent({
      githubEvent: "pull_request",
      body: repoBody({
        action: "opened",
        pull_request: {
          number: 9,
          state: "open",
          draft: true,
          merged: false,
          user: { login: "dev" },
          base: { ref: "main" },
          head: { ref: "feat" },
        },
      }),
    });
    expect(result).toMatchObject({ kind: "ignore", reason: "draft_pr" });
  });

  it("issues opened / labeled / closed", () => {
    const opened = mapGitHubWebhookEvent({
      githubEvent: "issues",
      body: repoBody({
        action: "opened",
        issue: {
          number: 7,
          labels: [{ name: "bug" }],
          updated_at: new Date().toISOString(),
        },
      }),
    });
    expect(opened.kind === "mapped" && opened.signal.type).toBe(
      "github.issue.opened",
    );

    const labeled = mapGitHubWebhookEvent({
      githubEvent: "issues",
      body: repoBody({
        action: "labeled",
        label: { name: "opera" },
        issue: { number: 7, labels: [{ name: "opera" }] },
      }),
      config: { issueLabelAllowlist: ["opera"] },
    });
    expect(labeled.kind === "mapped" && labeled.signal.type).toBe(
      "github.issue.labeled",
    );

    const closed = mapGitHubWebhookEvent({
      githubEvent: "issues",
      body: repoBody({
        action: "closed",
        issue: { number: 7, labels: [] },
      }),
    });
    expect(closed.kind === "mapped" && closed.signal.type).toBe(
      "github.issue.closed",
    );
  });

  it("push allowlist → github.push LOW; branch fora ignora", () => {
    const ok = mapGitHubWebhookEvent({
      githubEvent: "push",
      body: repoBody({
        ref: "refs/heads/main",
        after: "abcdef1234567890",
        commits: [{ id: "1" }, { id: "2" }],
      }),
    });
    expect(ok.kind).toBe("mapped");
    if (ok.kind === "mapped") {
      expect(ok.signal.type).toBe("github.push");
      expect(ok.signal.severity).toBe("LOW");
      expect(ok.signal.payload.push).toEqual({
        branch: "main",
        commitCount: 2,
      });
    }

    const denied = mapGitHubWebhookEvent({
      githubEvent: "push",
      body: repoBody({
        ref: "refs/heads/feature-x",
        after: "abcdef1234567890",
        commits: [],
      }),
    });
    expect(denied).toMatchObject({
      kind: "ignore",
      reason: "branch_not_allowlisted",
    });
  });

  it("eventos fora do MVP → ignore", () => {
    expect(
      mapGitHubWebhookEvent({
        githubEvent: "star",
        body: repoBody(),
      }),
    ).toMatchObject({ kind: "ignore", reason: "unmapped_event" });
    expect(
      mapGitHubWebhookEvent({
        githubEvent: "ping",
        body: repoBody(),
      }),
    ).toMatchObject({ kind: "ignore", reason: "health_ping" });
  });
});

describe("severityForGitHubSignalType", () => {
  it("casos de contrato", () => {
    expect(severityForGitHubSignalType("github.pr.updated")).toBe("LOW");
    expect(severityForGitHubSignalType("github.pr.opened")).toBe("MEDIUM");
    expect(severityForGitHubSignalType("github.pr.merged")).toBe("MEDIUM");
    expect(severityForGitHubSignalType("github.issue.opened")).toBe("MEDIUM");
    expect(severityForGitHubSignalType("github.push")).toBe("LOW");
  });
});
