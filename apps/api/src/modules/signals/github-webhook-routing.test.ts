/**
 * Multi-repository routing: repo → WorkspaceSourceBinding → workspaceId.
 * Nenhum evento pode cair em NEXO por padrao.
 */
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
import { processGithubWebhook } from "./github-webhook-pipeline.js";
import { extractGithubExternalRef } from "./github-external-ref.js";

const SECRET = "routing-secret";

function prBody(owner: string, repo: string, number = 1) {
  return {
    action: "opened",
    repository: {
      name: repo,
      full_name: `${owner}/${repo}`,
      default_branch: "main",
      owner: { login: owner },
      id: number,
    },
    sender: { login: "dev" },
    pull_request: {
      number,
      title: "feat",
      state: "open",
      draft: false,
      merged: false,
      html_url: `https://github.com/${owner}/${repo}/pull/${number}`,
      user: { login: "dev" },
      base: { ref: "main" },
      head: { ref: "feat" },
      updated_at: new Date().toISOString(),
    },
  };
}

async function setupOfficialBindings() {
  const store = new InMemoryDomainSignalStore();
  const signals = new DomainSignalService(store);
  const catalog = [
    { workspaceId: "operaia-lab", repo: "marieligalleani/operaia-lab" },
    { workspaceId: "nexo", repo: "marieligalleani/operaia-core-nexo" },
    { workspaceId: "infra", repo: "marieligalleani/operaia-infra" },
    { workspaceId: "flowgrid", repo: "marieligalleani/flowgrid" },
  ] as const;

  for (const entry of catalog) {
    await signals.upsertBinding({
      workspaceId: entry.workspaceId,
      sourceType: "github",
      externalRef: entry.repo,
      enabled: true,
      secretRef: "env:GITHUB_WEBHOOK_SECRET",
    });
  }

  const bridge = new GitHubSourceBridge();
  const ingest = new DomainSignalIngestService({
    registry: createPlatformBridgeRegistry({
      internal: new InternalSourceBridge(),
      github: bridge,
    }),
    signals,
  });

  return { store, signals, bridge, ingest };
}

describe("GitHub multi-repository routing", () => {
  it("extrai externalRef canonico lowercase do payload", () => {
    expect(
      extractGithubExternalRef(
        prBody("MarieliGalleani", "operaia-infra"),
      ),
    ).toBe("marieligalleani/operaia-infra");
  });

  it("webhook operaia-lab → workspace operaia-lab", async () => {
    const { store, signals, bridge, ingest } = await setupOfficialBindings();
    const missions: string[] = [];
    const payload = prBody("MarieliGalleani", "operaia-lab", 10);
    const rawBody = JSON.stringify(payload);
    const deliveryId = randomUUID();

    const result = await processGithubWebhook(
      {
        signals,
        bridge,
        ingest,
        resolveSecret: () => SECRET,
        onConvertCandidate: async ({ signal }) => {
          missions.push(signal.workspaceId);
          return `mission-${signal.workspaceId}`;
        },
      },
      {
        rawBody,
        body: payload,
        headers: {
          signature256: signGitHubWebhookBody(rawBody, SECRET),
          deliveryId,
          githubEvent: "pull_request",
        },
      },
    );

    expect(result.httpStatus).toBe(202);
    if (result.httpStatus !== 202) return;
    expect(result.workspaceId).toBe("operaia-lab");
    expect(result.externalRef).toBe("marieligalleani/operaia-lab");
    expect(result.workspaceId).not.toBe("nexo");
    expect(missions).toEqual(["operaia-lab"]);

    const signal = await store.findByDelivery({
      sourceType: "github",
      deliveryId,
    });
    expect(signal?.workspaceId).toBe("operaia-lab");
    expect(signal?.sourceType).toBe("github");
    expect(signal?.deliveryId).toBe(deliveryId);
    expect(signal?.correlationId).toBeTruthy();
    expect(signal?.metadataJson?.externalRef).toBe(
      "marieligalleani/operaia-lab",
    );
  });

  it("webhook nexo → workspace nexo (somente via binding do repo)", async () => {
    const { signals, bridge, ingest } = await setupOfficialBindings();
    const payload = prBody("MarieliGalleani", "operaia-core-nexo", 2);
    const rawBody = JSON.stringify(payload);

    const result = await processGithubWebhook(
      {
        signals,
        bridge,
        ingest,
        resolveSecret: () => SECRET,
        onConvertCandidate: async ({ signal }) => `m-${signal.workspaceId}`,
      },
      {
        rawBody,
        body: payload,
        headers: {
          signature256: signGitHubWebhookBody(rawBody, SECRET),
          deliveryId: randomUUID(),
          githubEvent: "pull_request",
        },
      },
    );

    expect(result.httpStatus).toBe(202);
    if (result.httpStatus !== 202) return;
    expect(result.workspaceId).toBe("nexo");
    expect(result.externalRef).toBe("marieligalleani/operaia-core-nexo");
  });

  it("webhook infra → workspace infra (nao NEXO)", async () => {
    const { store, signals, bridge, ingest } = await setupOfficialBindings();
    const missions: Array<{ workspaceId: string }> = [];
    const payload = prBody("MarieliGalleani", "operaia-infra", 7);
    const rawBody = JSON.stringify(payload);
    const deliveryId = randomUUID();

    const result = await processGithubWebhook(
      {
        signals,
        bridge,
        ingest,
        resolveSecret: () => SECRET,
        onConvertCandidate: async ({ signal }) => {
          missions.push({ workspaceId: signal.workspaceId });
          return `mission-${signal.workspaceId}-${signal.id}`;
        },
      },
      {
        rawBody,
        body: payload,
        headers: {
          signature256: signGitHubWebhookBody(rawBody, SECRET),
          deliveryId,
          githubEvent: "pull_request",
        },
      },
    );

    expect(result.httpStatus).toBe(202);
    if (result.httpStatus !== 202) return;
    expect(result.workspaceId).toBe("infra");
    expect(result.externalRef).toBe("marieligalleani/operaia-infra");
    expect(result.workspaceId).not.toBe("nexo");
    expect(missions).toEqual([{ workspaceId: "infra" }]);

    const signal = await store.findByDelivery({
      sourceType: "github",
      deliveryId,
    });
    expect(signal?.workspaceId).toBe("infra");
    expect(signal?.workspaceId).not.toBe("nexo");
  });

  it("webhook flowgrid → MissionQueue no workspace flowgrid", async () => {
    const { signals, bridge, ingest } = await setupOfficialBindings();
    const payload = prBody("MarieliGalleani", "flowgrid", 3);
    const rawBody = JSON.stringify(payload);
    let enqueuedWorkspace: string | null = null;

    const result = await processGithubWebhook(
      {
        signals,
        bridge,
        ingest,
        resolveSecret: () => SECRET,
        onConvertCandidate: async ({ signal }) => {
          enqueuedWorkspace = signal.workspaceId;
          return "mission-flowgrid";
        },
      },
      {
        rawBody,
        body: payload,
        headers: {
          signature256: signGitHubWebhookBody(rawBody, SECRET),
          deliveryId: randomUUID(),
          githubEvent: "pull_request",
        },
      },
    );

    expect(result.httpStatus).toBe(202);
    if (result.httpStatus !== 202) return;
    expect(result.workspaceId).toBe("flowgrid");
    expect(enqueuedWorkspace).toBe("flowgrid");
    expect(enqueuedWorkspace).not.toBe("nexo");
  });

  it("repositorio desconhecido → 404 binding_missing (sem fallback NEXO)", async () => {
    const { store, signals, bridge, ingest } = await setupOfficialBindings();
    const payload = prBody("MarieliGalleani", "unknown-repo", 99);
    const rawBody = JSON.stringify(payload);
    let convertCalls = 0;

    const result = await processGithubWebhook(
      {
        signals,
        bridge,
        ingest,
        resolveSecret: () => SECRET,
        onConvertCandidate: async () => {
          convertCalls += 1;
          return "should-not-run";
        },
      },
      {
        rawBody,
        body: payload,
        headers: {
          signature256: signGitHubWebhookBody(rawBody, SECRET),
          deliveryId: randomUUID(),
          githubEvent: "pull_request",
        },
      },
    );

    expect(result).toMatchObject({
      httpStatus: 404,
      outcome: "rejected",
      reason: "binding_missing",
    });
    expect(convertCalls).toBe(0);

    // Nenhum sinal criado para repo desconhecido (sem fallback NEXO).
    const nexoSignals = await store.findBySignalHash({
      workspaceId: "nexo",
      signalHash: "x",
      limit: 100,
    });
    expect(nexoSignals).toHaveLength(0);
  });

  it("nenhum evento de outro repo cai no NEXO por padrao", async () => {
    const { store, signals, bridge, ingest } = await setupOfficialBindings();
    const repos = [
      ["MarieliGalleani", "operaia-lab", "operaia-lab"],
      ["MarieliGalleani", "operaia-infra", "infra"],
      ["MarieliGalleani", "flowgrid", "flowgrid"],
    ] as const;

    for (const [owner, repo, expectedWs] of repos) {
      const payload = prBody(owner, repo);
      const rawBody = JSON.stringify(payload);
      const deliveryId = randomUUID();
      const result = await processGithubWebhook(
        {
          signals,
          bridge,
          ingest,
          resolveSecret: () => SECRET,
          onConvertCandidate: async ({ signal }) => `m-${signal.workspaceId}`,
        },
        {
          rawBody,
          body: payload,
          headers: {
            signature256: signGitHubWebhookBody(rawBody, SECRET),
            deliveryId,
            githubEvent: "pull_request",
          },
        },
      );
      expect(result.httpStatus).toBe(202);
      if (result.httpStatus !== 202) continue;
      expect(result.workspaceId).toBe(expectedWs);
      expect(result.workspaceId).not.toBe("nexo");
      const signal = await store.findByDelivery({
        sourceType: "github",
        deliveryId,
      });
      expect(signal?.workspaceId).toBe(expectedWs);
      expect(signal?.workspaceId).not.toBe("nexo");
    }
  });
});
