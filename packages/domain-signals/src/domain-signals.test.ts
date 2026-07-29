import { describe, expect, it } from "vitest";
import {
  canTransition,
  computeSignalHash,
  DomainSignalService,
  InMemoryDomainSignalStore,
  redactPayload,
  REDACTED,
  signHmacSha256,
  verifyHmacSha256,
  assertTimestampWithinSkew,
} from "./index.js";

describe("lifecycle", () => {
  it("permite detected → evaluated → converted → resolved", () => {
    expect(canTransition("DETECTED", "EVALUATED")).toBe(true);
    expect(canTransition("EVALUATED", "CONVERTED")).toBe(true);
    expect(canTransition("CONVERTED", "RESOLVED")).toBe(true);
  });

  it("bloqueia converted sem evaluated", () => {
    expect(canTransition("DETECTED", "CONVERTED")).toBe(false);
  });
});

describe("security utils", () => {
  it("HMAC valida e rejeita assinatura invalida", () => {
    const body = '{"ok":true}';
    const secret = "test-secret";
    const sig = signHmacSha256(body, secret);
    expect(verifyHmacSha256({ rawBody: body, secret, signature: sig }).ok).toBe(
      true,
    );
    expect(
      verifyHmacSha256({
        rawBody: body,
        secret,
        signature: "sha256=deadbeef",
      }).ok,
    ).toBe(false);
  });

  it("replay skew rejeita timestamp antigo", () => {
    expect(
      assertTimestampWithinSkew({
        timestampMs: Date.now() - 60 * 60 * 1000,
        skewMs: 60_000,
      }).ok,
    ).toBe(false);
  });

  it("redact remove secrets", () => {
    const out = redactPayload({
      title: "PR",
      token: "secret-token",
      nested: { api_key: "x", keep: 1 },
    });
    expect(out.title).toBe("PR");
    expect(out.token).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).api_key).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).keep).toBe(1);
  });
});

describe("DomainSignalService", () => {
  it("ingest cria DETECTED com correlationId e payload redacted", async () => {
    const service = new DomainSignalService(new InMemoryDomainSignalStore());
    const result = await service.ingest({
      workspaceId: "ws-a",
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: "d-1",
      payload: { title: "hello", secret: "nope" },
    });
    expect(result.kind).toBe("created");
    expect(result.signal.status).toBe("DETECTED");
    expect(result.signal.correlationId.length).toBeGreaterThan(8);
    expect(result.signal.payloadJson.secret).toBe(REDACTED);
    expect(result.signal.signalHash.length).toBe(64);
  });

  it("mesmo deliveryId nao cria duplicata", async () => {
    const service = new DomainSignalService(new InMemoryDomainSignalStore());
    const input = {
      workspaceId: "ws-a",
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: "d-dup",
      payload: { n: 1 },
    };
    const first = await service.ingest(input);
    const second = await service.ingest({ ...input, payload: { n: 2 } });
    expect(first.kind).toBe("created");
    expect(second.kind).toBe("duplicate_delivery");
    expect(second.signal.id).toBe(first.signal.id);
  });

  it("mesmo signalHash NAO bloqueia eventos legítimos", async () => {
    const store = new InMemoryDomainSignalStore();
    const service = new DomainSignalService(store);
    const hash = computeSignalHash({
      workspaceId: "ws-a",
      type: "lab.probe",
      sourceId: "same",
    });
    const a = await service.ingest({
      workspaceId: "ws-a",
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: "d-a",
      sourceId: "same",
      signalHash: hash,
      payload: { wave: 1 },
    });
    const b = await service.ingest({
      workspaceId: "ws-a",
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: "d-b",
      sourceId: "same",
      signalHash: hash,
      payload: { wave: 2 },
    });
    expect(a.kind).toBe("created");
    expect(b.kind).toBe("created");
    expect(a.signal.id).not.toBe(b.signal.id);
    expect(a.signal.signalHash).toBe(b.signal.signalHash);

    const similar = await store.findBySignalHash({
      workspaceId: "ws-a",
      signalHash: hash,
    });
    expect(similar.length).toBe(2);
  });

  it("evaluate guarda decisao, politica e motivo", async () => {
    const service = new DomainSignalService(new InMemoryDomainSignalStore());
    const { signal } = await service.ingest({
      workspaceId: "ws-a",
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: "d-eval",
      payload: { ok: true },
    });
    const evaluated = await service.evaluate({
      signalId: signal.id,
      decision: "CONVERT_CANDIDATE",
      policy: "default-allowlist@1",
      reason: "ok",
      inputs: { allowlisted: true },
    });
    expect(evaluated.status).toBe("EVALUATED");
    expect(evaluated.evaluationDecision).toBe("CONVERT_CANDIDATE");
    expect(evaluated.evaluationPolicy).toBe("default-allowlist@1");
    expect(evaluated.evaluationReason).toBe("ok");
    expect(evaluated.evaluationJson?.decision).toBe("CONVERT_CANDIDATE");
    expect(evaluated.missionId).toBeNull();

    const ctx = await service.getOperaEvaluationContext(signal.id);
    expect(ctx.correlationId).toBe(signal.correlationId);
    expect(ctx.evaluation?.policy).toBe("default-allowlist@1");
    expect(ctx.missionId).toBeNull();
  });

  it("isolamento: binding de outro workspace e rejeitado", async () => {
    const service = new DomainSignalService(new InMemoryDomainSignalStore());
    const binding = await service.upsertBinding({
      workspaceId: "ws-a",
      sourceType: "internal",
      externalRef: "probe",
    });
    await expect(
      service.ingest({
        workspaceId: "ws-b",
        bindingId: binding.id,
        sourceType: "internal",
        type: "lab.probe",
        deliveryId: "d-iso",
        payload: {},
      }),
    ).rejects.toThrow(/isolamento/);
  });

  it("markConverted exige EVALUATED e nao cria missionId sozinho", async () => {
    const service = new DomainSignalService(new InMemoryDomainSignalStore());
    const { signal } = await service.ingest({
      workspaceId: "ws-a",
      sourceType: "internal",
      type: "lab.probe",
      deliveryId: "d-conv",
      payload: {},
    });
    await expect(
      service.markConverted({ signalId: signal.id, missionId: "m-1" }),
    ).rejects.toThrow(/EVALUATED/);

    await service.evaluate({
      signalId: signal.id,
      decision: "CONVERT_CANDIDATE",
      policy: "p@1",
      reason: "ok",
    });
    const converted = await service.markConverted({
      signalId: signal.id,
      missionId: "m-1",
    });
    expect(converted.status).toBe("CONVERTED");
    expect(converted.missionId).toBe("m-1");
  });
});
