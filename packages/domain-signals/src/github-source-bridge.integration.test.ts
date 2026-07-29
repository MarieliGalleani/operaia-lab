/**
 * Fluxo S3.1: GitHub payload → Bridge → NormalizedIngress → Ingest → DETECTED → Opera context.
 * In-memory (sem Prisma) + assert zero acoplamento a fila no modulo github.
 */
import { describe, expect, it } from "vitest";
import {
  createPlatformBridgeRegistry,
  DomainSignalIngestService,
  DomainSignalService,
  GitHubSourceBridge,
  InMemoryDomainSignalStore,
  InternalSourceBridge,
  signGitHubWebhookBody,
} from "./index.js";

const SECRET = "integration-secret";

describe("GitHubSourceBridge integration (in-memory)", () => {
  it("fluxo completo ate OperaEvaluationContext sem criar missao", async () => {
    const store = new InMemoryDomainSignalStore();
    const signals = new DomainSignalService(store);
    const github = new GitHubSourceBridge();
    const ingest = new DomainSignalIngestService({
      registry: createPlatformBridgeRegistry({
        internal: new InternalSourceBridge(),
        github,
      }),
      signals,
    });

    await signals.upsertBinding({
      workspaceId: "ws-gh",
      sourceType: "github",
      externalRef: "acme/operaia-lab",
      enabled: true,
    });

    const rawBody = JSON.stringify({
      action: "opened",
      repository: {
        name: "operaia-lab",
        default_branch: "main",
        owner: { login: "acme" },
      },
      sender: { login: "dev" },
      pull_request: {
        number: 99,
        state: "open",
        draft: false,
        merged: false,
        body: "secret body",
        user: { login: "dev" },
        base: { ref: "main" },
        head: { ref: "feat-s31" },
        updated_at: new Date().toISOString(),
      },
    });

    const accepted = github.acceptWebhook({
      rawBody,
      signature256: signGitHubWebhookBody(rawBody, SECRET),
      deliveryId: "gh-delivery-99",
      githubEvent: "pull_request",
      webhookSecret: SECRET,
      workspaceId: "ws-gh",
      correlationId: "corr-s31",
    });
    expect(accepted.kind).toBe("accepted");
    if (accepted.kind !== "accepted") {
      return;
    }

    const result = await ingest.ingest(accepted.event);
    expect(result.ingestResult).toBe("created");
    expect(result.signal.status).toBe("DETECTED");
    expect(result.signal.sourceType).toBe("github");
    expect(result.signal.type).toBe("github.pr.opened");
    expect(result.signal.deliveryId).toBe("gh-delivery-99");
    expect(result.signal.correlationId).toBe("corr-s31");
    expect(result.signal.missionId).toBeNull();
    expect(result.evaluationContext.signalId).toBe(result.signal.id);
    expect(result.evaluationContext.missionId).toBeNull();
    expect(result.evaluationContext.correlationId).toBe("corr-s31");

    const dup = await ingest.ingest(accepted.event);
    expect(dup.ingestResult).toBe("duplicate_delivery");
    expect(dup.signal.id).toBe(result.signal.id);
  });
});
