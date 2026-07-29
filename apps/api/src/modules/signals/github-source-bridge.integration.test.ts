/**
 * Domain Signal S3.1 — GitHub Bridge + Prisma ingest.
 * Skip se Postgres indisponivel. Sem rota HTTP. Sem MissionQueue.
 */
import "../operations/ensure-database-url.js";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  createPlatformBridgeRegistry,
  DomainSignalIngestService,
  DomainSignalService,
  GitHubSourceBridge,
  InternalSourceBridge,
  signGitHubWebhookBody,
} from "@operaia/domain-signals";
import { prisma } from "@operaia/database";
import { probeRealQueueReady } from "../operations/assisted-queue-real-harness.js";
import { PrismaDomainSignalStore } from "./prisma-domain-signal-store.js";

const READY = await probeRealQueueReady();
const SECRET = "prisma-gh-secret";

describe.skipIf(!READY.ok)("Domain Signal S3.1 — GitHub + Prisma", () => {
  const store = new PrismaDomainSignalStore();
  const signals = new DomainSignalService(store);
  const github = new GitHubSourceBridge();
  const ingest = new DomainSignalIngestService({
    registry: createPlatformBridgeRegistry({
      internal: new InternalSourceBridge(),
      github,
    }),
    signals,
  });

  const workspaceId = `gh-ws-${randomUUID().slice(0, 8)}`;
  const deliveryId = `gh-del-${randomUUID()}`;

  afterAll(async () => {
    await prisma.domainSignal.deleteMany({ where: { workspaceId } });
    await prisma.workspaceSourceBinding.deleteMany({ where: { workspaceId } });
    await prisma.$disconnect();
  });

  it("payload GitHub → DETECTED + OperaEvaluationContext", async () => {
    await signals.upsertBinding({
      workspaceId,
      sourceType: "github",
      externalRef: "acme/operaia-lab",
    });

    const rawBody = JSON.stringify({
      action: "opened",
      repository: {
        name: "operaia-lab",
        default_branch: "main",
        owner: { login: "acme" },
      },
      pull_request: {
        number: 7,
        state: "open",
        draft: false,
        merged: false,
        user: { login: "dev" },
        base: { ref: "main" },
        head: { ref: "feat" },
        updated_at: new Date().toISOString(),
      },
    });

    const accepted = github.acceptWebhook({
      rawBody,
      signature256: signGitHubWebhookBody(rawBody, SECRET),
      deliveryId,
      githubEvent: "pull_request",
      webhookSecret: SECRET,
      workspaceId,
      correlationId: `corr-${randomUUID()}`,
    });
    expect(accepted.kind).toBe("accepted");
    if (accepted.kind !== "accepted") {
      return;
    }

    const result = await ingest.ingest(accepted.event);
    expect(result.signal.status).toBe("DETECTED");
    expect(result.signal.type).toBe("github.pr.opened");
    expect(result.evaluationContext.missionId).toBeNull();
    expect(result.signal.missionId).toBeNull();
  });
});
