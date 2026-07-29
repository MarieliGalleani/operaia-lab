/**
 * Memory M1.1-style integration — Domain Signal S1 + Prisma.
 * Skip se Postgres indisponivel.
 */
import "../operations/ensure-database-url.js";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  DomainSignalService,
  REDACTED,
} from "@operaia/domain-signals";
import { prisma } from "@operaia/database";
import { probeRealQueueReady } from "../operations/assisted-queue-real-harness.js";
import { PrismaDomainSignalStore } from "./prisma-domain-signal-store.js";

const READY = await probeRealQueueReady();

describe.skipIf(!READY.ok)("Domain Signal S1 — PrismaDomainSignalStore", () => {
  const store = new PrismaDomainSignalStore();
  const service = new DomainSignalService(store);
  const workspaceA = `sig-ws-a-${randomUUID().slice(0, 8)}`;
  const workspaceB = `sig-ws-b-${randomUUID().slice(0, 8)}`;
  const deliveryPrefix = `del-${randomUUID().slice(0, 8)}`;

  afterAll(async () => {
    await prisma.domainSignal.deleteMany({
      where: { workspaceId: { in: [workspaceA, workspaceB] } },
    });
    await prisma.workspaceSourceBinding.deleteMany({
      where: { workspaceId: { in: [workspaceA, workspaceB] } },
    });
    await prisma.$disconnect();
  });

  it("persiste binding + signal com delivery dedupe e hash similar nao bloqueante", async () => {
    const binding = await service.upsertBinding({
      workspaceId: workspaceA,
      sourceType: "internal",
      externalRef: "lab/probe",
    });

    const hash = `hash-${randomUUID()}`;
    const first = await service.ingest({
      workspaceId: workspaceA,
      bindingId: binding.id,
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: `${deliveryPrefix}-1`,
      signalHash: hash,
      payload: { title: "one", token: "secret" },
    });
    expect(first.kind).toBe("created");
    expect(first.signal.payloadJson.token).toBe(REDACTED);

    const dup = await service.ingest({
      workspaceId: workspaceA,
      bindingId: binding.id,
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: `${deliveryPrefix}-1`,
      signalHash: hash,
      payload: { title: "dup" },
    });
    expect(dup.kind).toBe("duplicate_delivery");
    expect(dup.signal.id).toBe(first.signal.id);

    const second = await service.ingest({
      workspaceId: workspaceA,
      bindingId: binding.id,
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: `${deliveryPrefix}-2`,
      signalHash: hash,
      payload: { title: "two" },
    });
    expect(second.kind).toBe("created");
    expect(second.signal.id).not.toBe(first.signal.id);
    expect(second.signal.signalHash).toBe(hash);
  });

  it("isolamento workspace via binding", async () => {
    const bindingA = await service.upsertBinding({
      workspaceId: workspaceA,
      sourceType: "internal",
      externalRef: "iso",
    });
    await expect(
      service.ingest({
        workspaceId: workspaceB,
        bindingId: bindingA.id,
        sourceType: "internal",
        type: "lab.probe",
        deliveryId: `${deliveryPrefix}-iso`,
        payload: {},
      }),
    ).rejects.toThrow(/isolamento/);
  });

  it("evaluate auditavel + opera context sem missionId", async () => {
    const { signal } = await service.ingest({
      workspaceId: workspaceA,
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: `${deliveryPrefix}-eval`,
      payload: { ok: true },
      correlationId: `corr-${randomUUID()}`,
    });
    const evaluated = await service.evaluate({
      signalId: signal.id,
      decision: "CONVERT_CANDIDATE",
      policy: "default-allowlist@1",
      reason: "ok",
    });
    expect(evaluated.evaluationPolicy).toBe("default-allowlist@1");
    expect(evaluated.evaluationReason).toBe("ok");
    expect(evaluated.missionId).toBeNull();

    const ctx = await service.getOperaEvaluationContext(signal.id);
    expect(ctx.correlationId).toBe(signal.correlationId);
    expect(ctx.evaluation?.decision).toBe("CONVERT_CANDIDATE");
    expect(ctx.missionId).toBeNull();
  });
});
