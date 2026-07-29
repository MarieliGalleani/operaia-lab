/**
 * Domain Signal S2 — Ingest Bridge + Prisma.
 * Skip se Postgres indisponivel.
 */
import "../operations/ensure-database-url.js";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildInternalIngressEvent,
  createDefaultBridgeRegistry,
  DomainSignalIngestError,
  DomainSignalIngestService,
  DomainSignalService,
  InternalSourceBridge,
  REDACTED,
} from "@operaia/domain-signals";
import { prisma } from "@operaia/database";
import { probeRealQueueReady } from "../operations/assisted-queue-real-harness.js";
import { PrismaDomainSignalStore } from "./prisma-domain-signal-store.js";

const READY = await probeRealQueueReady();

describe.skipIf(!READY.ok)("Domain Signal S2 — Ingest + Prisma", () => {
  const store = new PrismaDomainSignalStore();
  const signals = new DomainSignalService(store);
  const ingest = new DomainSignalIngestService({
    registry: createDefaultBridgeRegistry(new InternalSourceBridge()),
    signals,
  });

  const workspaceA = `ing-ws-a-${randomUUID().slice(0, 8)}`;
  const workspaceB = `ing-ws-b-${randomUUID().slice(0, 8)}`;
  const deliveryPrefix = `ing-del-${randomUUID().slice(0, 8)}`;

  afterAll(async () => {
    await prisma.domainSignal.deleteMany({
      where: { workspaceId: { in: [workspaceA, workspaceB] } },
    });
    await prisma.workspaceSourceBinding.deleteMany({
      where: { workspaceId: { in: [workspaceA, workspaceB] } },
    });
    await prisma.$disconnect();
  });

  it("binding ativo aceita e cria DETECTED com correlationId", async () => {
    await signals.upsertBinding({
      workspaceId: workspaceA,
      sourceType: "internal",
      externalRef: "lab/probe",
    });
    const correlationId = `corr-${randomUUID()}`;
    const result = await ingest.ingest(
      buildInternalIngressEvent({
        workspaceId: workspaceA,
        externalRef: "lab/probe",
        deliveryId: `${deliveryPrefix}-1`,
        type: "lab.probe",
        payload: { title: "s2", token: "nope" },
        correlationId,
      }),
    );
    expect(result.ingestResult).toBe("created");
    expect(result.signal.status).toBe("DETECTED");
    expect(result.signal.correlationId).toBe(correlationId);
    expect(result.signal.payloadJson.token).toBe(REDACTED);
    expect(result.evaluationContext.signalId).toBe(result.signal.id);
    expect(result.evaluationContext.missionId).toBeNull();
  });

  it("binding desabilitado rejeita", async () => {
    await signals.upsertBinding({
      workspaceId: workspaceA,
      sourceType: "internal",
      externalRef: "off",
      enabled: false,
    });
    await expect(
      ingest.ingest(
        buildInternalIngressEvent({
          workspaceId: workspaceA,
          externalRef: "off",
          deliveryId: `${deliveryPrefix}-off`,
          type: "lab.probe",
          payload: {},
        }),
      ),
    ).rejects.toBeInstanceOf(DomainSignalIngestError);
  });

  it("duplicate delivery retorna existente", async () => {
    await signals.upsertBinding({
      workspaceId: workspaceA,
      sourceType: "internal",
      externalRef: "dup",
    });
    const event = buildInternalIngressEvent({
      workspaceId: workspaceA,
      externalRef: "dup",
      deliveryId: `${deliveryPrefix}-dup`,
      type: "lab.probe",
      payload: { n: 1 },
    });
    const first = await ingest.ingest(event);
    const second = await ingest.ingest(event);
    expect(first.ingestResult).toBe("created");
    expect(second.ingestResult).toBe("duplicate_delivery");
    expect(second.signal.id).toBe(first.signal.id);
  });

  it("isolamento: workspace A nao usa binding de B", async () => {
    await signals.upsertBinding({
      workspaceId: workspaceB,
      sourceType: "internal",
      externalRef: "iso",
    });
    await expect(
      ingest.ingest(
        buildInternalIngressEvent({
          workspaceId: workspaceA,
          externalRef: "iso",
          deliveryId: `${deliveryPrefix}-iso`,
          type: "lab.probe",
          payload: {},
        }),
      ),
    ).rejects.toMatchObject({ rejectionReason: "binding_missing" });
  });
});
