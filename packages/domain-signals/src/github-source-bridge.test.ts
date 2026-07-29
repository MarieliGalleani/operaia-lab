import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GitHubSourceBridge,
  signGitHubWebhookBody,
} from "./github-source-bridge.js";
import { REDACTED } from "./redact.js";

const SECRET = "test-webhook-secret";

function prOpenedBody(overrides: Record<string, unknown> = {}) {
  return {
    action: "opened",
    repository: {
      name: "operaia-lab",
      default_branch: "main",
      owner: { login: "acme" },
    },
    sender: { login: "dev" },
    pull_request: {
      number: 42,
      state: "open",
      draft: false,
      merged: false,
      body: "should not persist",
      user: { login: "dev", email: "dev@example.com" },
      base: { ref: "main" },
      head: { ref: "feat" },
      updated_at: new Date().toISOString(),
      token: "leak",
      ...overrides,
    },
  };
}

describe("GitHubSourceBridge", () => {
  it("assinatura valida → NormalizedIngressEvent redigido", () => {
    const bridge = new GitHubSourceBridge();
    const body = JSON.stringify(prOpenedBody());
    const result = bridge.acceptWebhook({
      rawBody: body,
      signature256: signGitHubWebhookBody(body, SECRET),
      deliveryId: "del-1",
      githubEvent: "pull_request",
      webhookSecret: SECRET,
      workspaceId: "ws-1",
      correlationId: "corr-gh-1",
    });
    expect(result.kind).toBe("accepted");
    if (result.kind === "accepted") {
      expect(result.event.sourceType).toBe("github");
      expect(result.event.type).toBe("github.pr.opened");
      expect(result.event.deliveryId).toBe("del-1");
      expect(result.event.correlationId).toBe("corr-gh-1");
      expect(result.severity).toBe("MEDIUM");
      expect(result.event.payload).not.toHaveProperty("body");
      expect(
        (result.event.payload.pullRequest as Record<string, unknown>)?.token,
      ).toBeUndefined();
      const nested = result.event.payload as Record<string, unknown>;
      expect(JSON.stringify(nested)).not.toContain("dev@example.com");
      void REDACTED;
    }
  });

  it("assinatura invalida → rejected hmac_failed", () => {
    const bridge = new GitHubSourceBridge();
    const body = JSON.stringify(prOpenedBody());
    const result = bridge.acceptWebhook({
      rawBody: body,
      signature256: "sha256=deadbeef",
      deliveryId: "del-bad",
      githubEvent: "pull_request",
      webhookSecret: SECRET,
      workspaceId: "ws-1",
    });
    expect(result).toMatchObject({
      kind: "rejected",
      reason: "hmac_failed",
    });
  });

  it("replay skew por occurredAt antigo", () => {
    const bridge = new GitHubSourceBridge();
    const body = JSON.stringify(
      prOpenedBody({
        updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    );
    const result = bridge.acceptWebhook({
      rawBody: body,
      signature256: signGitHubWebhookBody(body, SECRET),
      deliveryId: "del-skew",
      githubEvent: "pull_request",
      webhookSecret: SECRET,
      workspaceId: "ws-1",
      skewMs: 60_000,
    });
    expect(result).toMatchObject({
      kind: "rejected",
      reason: "replay_skew",
    });
  });

  it("evento ignorado (star)", () => {
    const bridge = new GitHubSourceBridge();
    const body = JSON.stringify({
      repository: {
        name: "operaia-lab",
        default_branch: "main",
        owner: { login: "acme" },
      },
    });
    const result = bridge.acceptWebhook({
      rawBody: body,
      signature256: signGitHubWebhookBody(body, SECRET),
      deliveryId: "del-star",
      githubEvent: "star",
      webhookSecret: SECRET,
      workspaceId: "ws-1",
    });
    expect(result).toMatchObject({ kind: "ignored", reason: "unmapped_event" });
  });

  it("severity correta em metadata", () => {
    const bridge = new GitHubSourceBridge();
    const body = JSON.stringify({
      action: "synchronize",
      repository: {
        name: "operaia-lab",
        default_branch: "main",
        owner: { login: "acme" },
      },
      pull_request: {
        number: 1,
        state: "open",
        draft: false,
        merged: false,
        user: { login: "dev" },
        base: { ref: "main" },
        head: { ref: "x" },
        updated_at: new Date().toISOString(),
      },
    });
    const result = bridge.acceptWebhook({
      rawBody: body,
      signature256: signGitHubWebhookBody(body, SECRET),
      deliveryId: "del-upd",
      githubEvent: "pull_request",
      webhookSecret: SECRET,
      workspaceId: "ws-1",
    });
    expect(result.kind).toBe("accepted");
    if (result.kind === "accepted") {
      expect(result.event.type).toBe("github.pr.updated");
      expect(result.severity).toBe("LOW");
      expect(result.event.metadata?.severity).toBe("LOW");
    }
  });
});

describe("GitHubSourceBridge architecture", () => {
  it("nao importa ledger/Prisma/fila/matcher/execution", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const files = ["github-source-bridge.ts", "github-event-mapper.ts"];
    const forbiddenImports = [
      /from\s+["'][^"']*domain-signal-service/,
      /from\s+["'][^"']*domain-signal-store/,
      /from\s+["'][^"']*types\.js["']/,
      /from\s+["']@operaia\/database/,
      /from\s+["'][^"']*mission-queue/,
      /from\s+["']@operaia\/execution-engine/,
      /from\s+["'][^"']*prisma/,
    ];
    const forbiddenSymbols = [
      "DomainSignalRecord",
      "DomainSignalService",
      "DomainSignalIngestService",
      "MissionQueue",
      "QueuedMissionExecutor",
      "MissionOrchestrator",
      "DelegationService",
      "ExecutionEngine",
      "Prisma",
    ];
    for (const name of files) {
      const text = readFileSync(join(root, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const pattern of forbiddenImports) {
        expect(pattern.test(text), `${name} import ${pattern}`).toBe(false);
      }
      for (const symbol of forbiddenSymbols) {
        expect(text.includes(symbol), `${name} → ${symbol}`).toBe(false);
      }
    }
  });
});
