/**
 * Integration: CONVERT → MissionQueue real (Prisma) → owner Opera.
 * Skip se Postgres indisponivel.
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
import { MissionQueue } from "../runtime/mission-queue.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "../runtime/mission-states.js";
import { enqueueSignalCoordinateMission } from "../runtime/signal-mission-converter.js";
import { AlreadyDoneGate } from "../runtime/work-governance/already-done-gate.js";
import { InMemoryWorkGovernanceLedger } from "../runtime/work-governance/decision-ledger.js";
import { InMemoryPriorMissionLookup } from "../runtime/work-governance/prior-mission-lookup.js";
import { processGithubWebhook } from "./github-webhook-pipeline.js";
import { PrismaDomainSignalStore } from "./prisma-domain-signal-store.js";

const READY = await probeRealQueueReady();
const SECRET = "gh-int-secret";

function createTestGate(): AlreadyDoneGate {
  return new AlreadyDoneGate({
    ledger: new InMemoryWorkGovernanceLedger(),
    missions: new InMemoryPriorMissionLookup(),
  });
}

describe.skipIf(!READY.ok)(
  "GitHub webhook → MissionQueue (integration)",
  () => {
    const store = new PrismaDomainSignalStore();
    const signals = new DomainSignalService(store);
    const bridge = new GitHubSourceBridge();
    const ingest = new DomainSignalIngestService({
      registry: createPlatformBridgeRegistry({
        internal: new InternalSourceBridge(),
        github: bridge,
      }),
      signals,
    });
    const queue = new MissionQueue();
    const workspaceId = `nexo-gh-${randomUUID().slice(0, 8)}`;
    const deliveryId = `del-${randomUUID()}`;
    let missionId: string | null = null;

    afterAll(async () => {
      if (missionId) {
        await prisma.missionEvent.deleteMany({ where: { missionId } });
        await prisma.mission.deleteMany({ where: { id: missionId } });
      }
      await prisma.domainSignal.deleteMany({ where: { workspaceId } });
      await prisma.workspaceSourceBinding.deleteMany({ where: { workspaceId } });
      await prisma.$disconnect();
    });

    it("persiste auditoria Webhook → Signal → Decision → Mission", async () => {
      await signals.upsertBinding({
        workspaceId,
        sourceType: "github",
        externalRef: "acme/operaia-lab",
        secretRef: "env:GITHUB_WEBHOOK_SECRET",
      });

      const payload = {
        action: "opened",
        repository: {
          name: "operaia-lab",
          full_name: "acme/operaia-lab",
          default_branch: "main",
          owner: { login: "acme" },
          id: 99,
        },
        sender: { login: "dev" },
        pull_request: {
          number: 99,
          title: "feat",
          state: "open",
          draft: false,
          merged: false,
          html_url: "https://github.com/acme/operaia-lab/pull/99",
          user: { login: "dev" },
          base: { ref: "main" },
          head: { ref: "feat" },
          updated_at: new Date().toISOString(),
        },
      };
      const rawBody = JSON.stringify(payload);

      const result = await processGithubWebhook(
        {
          signals,
          bridge,
          ingest,
          resolveSecret: () => SECRET,
          onConvertCandidate: async ({ signal }) =>
            enqueueSignalCoordinateMission({
              queue,
              signal,
              gate: createTestGate(),
            }),
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
      if (result.httpStatus !== 202) {
        return;
      }
      expect(result.outcome).toBe("converted");
      missionId = result.missionId;
      expect(missionId).toBeTruthy();

      const signal = await store.findByDelivery({
        sourceType: "github",
        deliveryId,
      });
      expect(signal?.status).toBe("CONVERTED");
      expect(signal?.evaluationDecision).toBe("CONVERT_CANDIDATE");
      expect(signal?.missionId).toBe(missionId);

      const mission = await queue.get(missionId!);
      expect(mission?.missionKind).toBe(MissionKind.COORDINATE);
      expect(mission?.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
      expect(mission?.workspaceId).toBe(workspaceId);
    });
  },
);
