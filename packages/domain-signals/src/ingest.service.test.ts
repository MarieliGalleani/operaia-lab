import { describe, expect, it } from "vitest";
import {
  buildInternalIngressEvent,
  createDefaultBridgeRegistry,
  DomainSignalIngestError,
  DomainSignalIngestService,
  DomainSignalService,
  InMemoryDomainSignalStore,
  InternalSourceBridge,
  REDACTED,
  type IngestObservation,
} from "./index.js";

function createIngest() {
  const store = new InMemoryDomainSignalStore();
  const signals = new DomainSignalService(store);
  const observations: IngestObservation[] = [];
  const ingest = new DomainSignalIngestService({
    registry: createDefaultBridgeRegistry(new InternalSourceBridge()),
    signals,
    observer: (event) => {
      observations.push(event);
    },
  });
  return { store, signals, ingest, observations };
}

describe("DomainSignalIngestService", () => {
  it("evento valido gera DomainSignal DETECTED + OperaEvaluationContext", async () => {
    const { signals, ingest, observations } = createIngest();
    await signals.upsertBinding({
      workspaceId: "ws-a",
      sourceType: "internal",
      externalRef: "lab/probe",
    });

    const result = await ingest.ingest(
      buildInternalIngressEvent({
        workspaceId: "ws-a",
        externalRef: "lab/probe",
        deliveryId: "d-ok",
        type: "lab.probe",
        payload: { title: "hello", secret: "x" },
        correlationId: "corr-ok",
      }),
    );

    expect(result.ingestResult).toBe("created");
    expect(result.signal.status).toBe("DETECTED");
    expect(result.signal.correlationId).toBe("corr-ok");
    expect(result.signal.payloadJson.secret).toBe(REDACTED);
    expect(result.evaluationContext.signalId).toBe(result.signal.id);
    expect(result.evaluationContext.correlationId).toBe("corr-ok");
    expect(result.evaluationContext.missionId).toBeNull();
    expect(observations.at(-1)?.result).toBe("accepted");
  });

  it("duplicate delivery retorna existente", async () => {
    const { signals, ingest } = createIngest();
    await signals.upsertBinding({
      workspaceId: "ws-a",
      sourceType: "internal",
      externalRef: "lab/probe",
    });
    const event = buildInternalIngressEvent({
      workspaceId: "ws-a",
      externalRef: "lab/probe",
      deliveryId: "d-dup",
      type: "lab.probe",
      payload: { n: 1 },
    });
    const first = await ingest.ingest(event);
    const second = await ingest.ingest({
      ...event,
      payload: { n: 2 },
    });
    expect(first.ingestResult).toBe("created");
    expect(second.ingestResult).toBe("duplicate_delivery");
    expect(second.signal.id).toBe(first.signal.id);
  });

  it("binding ausente rejeita", async () => {
    const { ingest, observations } = createIngest();
    await expect(
      ingest.ingest(
        buildInternalIngressEvent({
          workspaceId: "ws-a",
          externalRef: "missing",
          deliveryId: "d-miss",
          type: "lab.probe",
          payload: {},
        }),
      ),
    ).rejects.toBeInstanceOf(DomainSignalIngestError);

    expect(observations.at(-1)?.rejectionReason).toBe("binding_missing");
  });

  it("binding desabilitado rejeita", async () => {
    const { signals, ingest, observations } = createIngest();
    await signals.upsertBinding({
      workspaceId: "ws-a",
      sourceType: "internal",
      externalRef: "off",
      enabled: false,
    });
    await expect(
      ingest.ingest(
        buildInternalIngressEvent({
          workspaceId: "ws-a",
          externalRef: "off",
          deliveryId: "d-off",
          type: "lab.probe",
          payload: {},
        }),
      ),
    ).rejects.toMatchObject({ rejectionReason: "binding_disabled" });
    expect(observations.at(-1)?.rejectionReason).toBe("binding_disabled");
  });

  it("workspace A nao acessa binding de B", async () => {
    const { signals, ingest } = createIngest();
    await signals.upsertBinding({
      workspaceId: "ws-b",
      sourceType: "internal",
      externalRef: "shared-ref",
    });
    await expect(
      ingest.ingest(
        buildInternalIngressEvent({
          workspaceId: "ws-a",
          externalRef: "shared-ref",
          deliveryId: "d-iso",
          type: "lab.probe",
          payload: {},
        }),
      ),
    ).rejects.toMatchObject({ rejectionReason: "binding_missing" });
  });

  it("unknown bridge rejeita", async () => {
    const { ingest } = createIngest();
    const event = buildInternalIngressEvent({
      workspaceId: "ws-a",
      externalRef: "x",
      deliveryId: "d-unk",
      type: "lab.probe",
      payload: {},
    });
    await expect(
      ingest.ingest({ ...event, sourceType: "github" }),
    ).rejects.toMatchObject({ rejectionReason: "unknown_bridge" });
  });
});
