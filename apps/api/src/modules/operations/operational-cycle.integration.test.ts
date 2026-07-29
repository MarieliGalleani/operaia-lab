/**
 * Operational Cycle Proof — integracao real Mission Queue (Fase 3 DoD).
 * Skip automatico se Postgres/NEXO indisponivel.
 *
 * Valida:
 * 1. Continuous Runtime no boot
 * 2. Workers consumindo a fila (9/9)
 * 3. Supervisor ativo
 * 4. Mission Events
 * 5. resultJson com final
 * 6. Mission COMPLETED
 * Entradas: POST /employees/:id/ask e POST /operations/missions
 *
 * Fora de escopo: memoria.
 */
import "./ensure-database-url.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createRealAssistedQueueBundle,
  disposeRealAssistedQueueBundle,
  probeRealQueueReady,
  runOperationalCycleProof,
  EXPECTED_WORKER_COUNT,
  type OperationalCycleProofEvidence,
  type RealAssistedQueueBundle,
} from "./operational-cycle-proof-harness.js";

const READY = await probeRealQueueReady();

describe.skipIf(!READY.ok)(
  "Operational Cycle Proof — Digital Office via Mission Queue",
  () => {
    let bundle: RealAssistedQueueBundle;
    let evidence: OperationalCycleProofEvidence;

    beforeAll(async () => {
      bundle = await createRealAssistedQueueBundle();
      evidence = await runOperationalCycleProof(bundle);
      console.log(
        "[operational-cycle-proof] DoD",
        JSON.stringify(evidence.dod, null, 2),
      );
    }, 360_000);

    afterAll(async () => {
      if (bundle) {
        await disposeRealAssistedQueueBundle(bundle);
      }
    }, 30_000);

    it("1. Continuous Runtime inicia corretamente no boot", () => {
      expect(evidence.boot.continuousStarted).toBe(true);
      expect(evidence.boot.readinessCanStartWorkers).toBe(true);
      expect(evidence.boot.preferQueue).toBe(true);
      expect(evidence.dod.continuousRuntimeBoot).toBe(true);
    });

    it("2. Workers estao consumindo a fila", () => {
      expect(evidence.boot.workersAlive).toBe(EXPECTED_WORKER_COUNT);
      expect(evidence.boot.workersExpected).toBe(9);
      expect(evidence.dod.workersConsuming).toBe(true);
    });

    it("3. Supervisor esta ativo", () => {
      expect(evidence.boot.supervisorRunning).toBe(true);
      expect(evidence.dod.supervisorActive).toBe(true);
    });

    it("4. Mission Events estao sendo registrados", () => {
      for (const cycle of [evidence.ask, evidence.operations]) {
        expect(cycle.eventTypes.length).toBeGreaterThan(0);
        expect(
          cycle.eventTypes.some((t) =>
            ["enqueued", "claimed", "waiting", "completed"].includes(t),
          ),
        ).toBe(true);
      }
      expect(evidence.dod.missionEventsRegistered).toBe(true);
    });

    it("5. resultJson contem resultado final", () => {
      expect(evidence.ask.rootHasInitial).toBe(true);
      expect(evidence.ask.rootHasFinal).toBe(true);
      expect(evidence.operations.rootHasInitial).toBe(true);
      expect(evidence.operations.rootHasFinal).toBe(true);
      expect(evidence.dod.resultJsonHasFinal).toBe(true);
    });

    it("6. Mission status termina COMPLETED (ask + operations)", () => {
      expect(evidence.ask.rootStatus).toBe("COMPLETED");
      expect(evidence.operations.rootStatus).toBe("COMPLETED");
      expect(evidence.ask.missionKind).toBe("COORDINATE");
      expect(evidence.operations.missionKind).toBe("COORDINATE");
      expect(evidence.ask.rootOwnerEmployeeId).toBe("operaia-ceo");
      expect(evidence.operations.rootOwnerEmployeeId).toBe("operaia-ceo");
      expect(evidence.dod.missionCompleted).toBe(true);
    });

    it("ciclo ask: COORDINATE → Mag EXECUTE → CONSOLIDATE (HTTP)", () => {
      expect(evidence.ask.httpStatusCode).toBe(200);
      expect(evidence.ask.executeChildren.length).toBeGreaterThan(0);
      expect(
        evidence.ask.executeChildren.every((c) => c.status === "COMPLETED"),
      ).toBe(true);
      expect(
        evidence.ask.consolidateChildren.some((c) => c.status === "COMPLETED"),
      ).toBe(true);
      expect(evidence.ask.orchestratorCalled).toBe(false);
      expect(evidence.ask.usableResultLength).toBeGreaterThan(0);
      expect(evidence.dod.askFullCycle).toBe(true);
    });

    it("ciclo operations: COORDINATE → Mag EXECUTE → CONSOLIDATE (HTTP)", () => {
      expect(evidence.operations.httpStatusCode).toBe(201);
      expect(evidence.operations.executeChildren.length).toBeGreaterThan(0);
      expect(
        evidence.operations.executeChildren.every(
          (c) => c.status === "COMPLETED",
        ),
      ).toBe(true);
      expect(
        evidence.operations.consolidateChildren.some(
          (c) => c.status === "COMPLETED",
        ),
      ).toBe(true);
      expect(evidence.operations.orchestratorCalled).toBe(false);
      expect(evidence.operations.usableResultLength).toBeGreaterThan(0);
      expect(evidence.dod.operationsFullCycle).toBe(true);
    });

    it("DoD operacional: Queue e o coracao — allPassed", () => {
      expect(evidence.missionPersistsInPrismaAfterCycle).toBe(true);
      expect(evidence.operationalRunPresentInStore).toBe(true);
      expect(evidence.dod.pathANotUsed).toBe(true);
      expect(evidence.dod.allPassed).toBe(true);
    });
  },
);

describe("Operational Cycle Proof — probe ambiente", () => {
  it("reporta motivo quando ambiente real nao esta pronto", () => {
    if (READY.ok) {
      expect(READY.nexoId).toBeTruthy();
      return;
    }
    expect(READY.reason).toBeTruthy();
    console.warn(`[operational-cycle] skip suite real: ${READY.reason}`);
  });
});
