/**
 * Etapas 1–4: webhook HMAC → DomainSignal → Policy → convert callback.
 * Sem Prisma na fila: onConvertCandidate e fake (arquitetura: convert fora do ledger).
 */
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createPlatformBridgeRegistry,
  DomainSignalIngestService,
  DomainSignalService,
  GitHubSourceBridge,
  InMemoryDomainSignalStore,
  InternalSourceBridge,
  signGitHubWebhookBody,
} from "@operaia/domain-signals";
import { createGithubWebhookRoutes } from "./github-webhook.routes.js";
import { buildSignalCoordinateObjective } from "../runtime/signal-mission-converter.js";

const SECRET = "test-webhook-secret";

function prOpenedBody() {
  return {
    action: "opened",
    repository: {
      name: "operaia-lab",
      full_name: "acme/operaia-lab",
      default_branch: "main",
      owner: { login: "acme" },
      id: 1,
    },
    sender: { login: "dev" },
    pull_request: {
      number: 42,
      title: "feat: auth",
      state: "open",
      draft: false,
      merged: false,
      html_url: "https://github.com/acme/operaia-lab/pull/42",
      user: { login: "dev" },
      base: { ref: "main" },
      head: { ref: "feat" },
      updated_at: new Date().toISOString(),
    },
  };
}

describe("POST /api/v1/webhooks/github — pipeline operacional", () => {
  it("HMAC invalido → 401", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: "github",
      externalRef: "acme/operaia-lab",
      secretRef: "env:GITHUB_WEBHOOK_SECRET",
    });
    const bridge = new GitHubSourceBridge();
    const ingest = new DomainSignalIngestService({
      registry: createPlatformBridgeRegistry({
        internal: new InternalSourceBridge(),
        github: bridge,
      }),
      signals,
    });

    const app = Fastify();
    await app.register(
      createGithubWebhookRoutes({
        signals,
        bridge,
        ingest,
        resolveSecret: () => SECRET,
      }),
      { prefix: "/api/v1/webhooks" },
    );

    const body = JSON.stringify(prOpenedBody());
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=deadbeef",
        "x-github-delivery": randomUUID(),
        "x-github-event": "pull_request",
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("evento CONVERT → DomainSignal CONVERTED + missionId (callback Opera)", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: "github",
      externalRef: "acme/operaia-lab",
      secretRef: "env:GITHUB_WEBHOOK_SECRET",
    });
    const bridge = new GitHubSourceBridge();
    const ingest = new DomainSignalIngestService({
      registry: createPlatformBridgeRegistry({
        internal: new InternalSourceBridge(),
        github: bridge,
      }),
      signals,
    });

    const enqueued: Array<{ workspaceId: string; objective: string }> = [];
    const missionId = `mission-${randomUUID()}`;

    const app = Fastify();
    await app.register(
      createGithubWebhookRoutes({
        signals,
        bridge,
        ingest,
        resolveSecret: () => SECRET,
        onConvertCandidate: async ({ signal }) => {
          enqueued.push({
            workspaceId: signal.workspaceId,
            objective: buildSignalCoordinateObjective(signal),
          });
          return missionId;
        },
      }),
      { prefix: "/api/v1/webhooks" },
    );

    const payload = prOpenedBody();
    const rawBody = JSON.stringify(payload);
    const deliveryId = randomUUID();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signGitHubWebhookBody(rawBody, SECRET),
        "x-github-delivery": deliveryId,
        "x-github-event": "pull_request",
      },
      payload: rawBody,
    });

    expect(res.statusCode).toBe(202);
    const json = res.json() as {
      outcome: string;
      signalId: string;
      missionId: string;
      decision: string;
      workspaceId: string;
    };
    expect(json.outcome).toBe("converted");
    expect(json.decision).toBe("CONVERT_CANDIDATE");
    expect(json.workspaceId).toBe("nexo");
    expect(json.missionId).toBe(missionId);

    const stored = await store.findByDelivery({
      sourceType: "github",
      deliveryId,
    });
    expect(stored?.status).toBe("CONVERTED");
    expect(stored?.missionId).toBe(missionId);
    expect(stored?.evaluationDecision).toBe("CONVERT_CANDIDATE");
    expect(stored?.evaluationPolicy).toBe("github-default@2");

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.workspaceId).toBe("nexo");
    expect(enqueued[0]?.objective).toContain("[COORDINATE/SIGNAL]");
    expect(enqueued[0]?.objective).toContain("github.pr.opened");

    await app.close();
  });

  it("pr.closed unmerged → IGNORE sem convert", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    await signals.upsertBinding({
      workspaceId: "nexo",
      sourceType: "github",
      externalRef: "acme/operaia-lab",
    });
    const bridge = new GitHubSourceBridge();
    const ingest = new DomainSignalIngestService({
      registry: createPlatformBridgeRegistry({
        internal: new InternalSourceBridge(),
        github: bridge,
      }),
      signals,
    });
    let convertCalls = 0;

    const app = Fastify();
    await app.register(
      createGithubWebhookRoutes({
        signals,
        bridge,
        ingest,
        resolveSecret: () => SECRET,
        onConvertCandidate: async () => {
          convertCalls += 1;
          return "should-not-run";
        },
      }),
      { prefix: "/api/v1/webhooks" },
    );

    const payload = {
      action: "closed",
      repository: {
        name: "operaia-lab",
        full_name: "acme/operaia-lab",
        default_branch: "main",
        owner: { login: "acme" },
        id: 1,
      },
      sender: { login: "dev" },
      pull_request: {
        number: 7,
        title: "wip",
        state: "closed",
        draft: false,
        merged: false,
        html_url: "https://github.com/acme/operaia-lab/pull/7",
        user: { login: "dev" },
        base: { ref: "main" },
        head: { ref: "wip" },
        updated_at: new Date().toISOString(),
      },
    };
    const rawBody = JSON.stringify(payload);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signGitHubWebhookBody(rawBody, SECRET),
        "x-github-delivery": randomUUID(),
        "x-github-event": "pull_request",
      },
      payload: rawBody,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      outcome: "ignored",
      decision: "IGNORE",
    });
    expect(convertCalls).toBe(0);
    await app.close();
  });
});
