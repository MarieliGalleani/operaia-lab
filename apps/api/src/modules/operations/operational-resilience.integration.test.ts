/**
 * Operational Resilience Proof — integracao real (restart / dedupe / reclaim).
 * Skip automatico se Postgres/NEXO indisponivel.
 *
 * Fora de escopo: memoria, remocao do Path A.
 */
import "./ensure-database-url.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createResilienceQueueBundle,
  disposeResilienceQueueBundle,
  probeRealQueueReady,
  runOperationalResilienceProof,
  type OperationalResilienceProofEvidence,
  type ResilienceBundle,
} from "./operational-resilience-proof-harness.js";

const READY = await probeRealQueueReady();

describe.skipIf(!READY.ok)(
  "Operational Resilience Proof — falhas operacionais",
  () => {
    let bundle: ResilienceBundle;
    let evidence: OperationalResilienceProofEvidence;

    beforeAll(async () => {
      bundle = await createResilienceQueueBundle();
      evidence = await runOperationalResilienceProof(bundle);
      console.log(
        "[operational-resilience-proof] DoD",
        JSON.stringify(evidence.dod, null, 2),
      );
    }, 300_000);

    afterAll(async () => {
      if (bundle) {
        await disposeResilienceQueueBundle(bundle);
      }
    }, 30_000);

    it("1. Restart Recovery — missao nao duplicada", () => {
      expect(evidence.restart.statusWhileDown).toBe("RUNNING");
      expect(evidence.restart.duplicateCountWhileDown).toBe(1);
      expect(evidence.restart.finalDuplicateCount).toBe(1);
      expect(evidence.dod.restartNoDuplicate).toBe(true);
    });

    it("1. Restart Recovery — worker retoma apos restart", () => {
      expect(evidence.restart.recoveredEvent).toBe(true);
      expect(evidence.restart.workersAliveAfterRestart).toBeGreaterThanOrEqual(
        1,
      );
      expect(evidence.restart.claimedAfterRecover).toBe(true);
      expect(evidence.dod.restartWorkerResumes).toBe(true);
    });

    it("1. Restart Recovery — estado final consistente", () => {
      expect(["RUNNING", "WAITING", "COMPLETED"]).toContain(
        evidence.restart.statusAfterReclaim,
      );
      expect(evidence.dod.restartFinalConsistent).toBe(true);
    });

    it("2. Supervisor Deduplication — enqueue duplicado nao cria nova missao", () => {
      expect(evidence.supervisorDedupe.firstEnqueueCreated).toBe(true);
      expect(evidence.supervisorDedupe.secondEnqueueCreated).toBe(false);
      expect(evidence.supervisorDedupe.sameMissionId).toBe(true);
      expect(evidence.supervisorDedupe.openCountAfterDoubleEnqueue).toBe(1);
    });

    it("2. Supervisor Deduplication — multiplos ciclos sem duplicar objective", () => {
      expect(evidence.supervisorDedupe.noDuplicateAfterCycles).toBe(true);
      expect(evidence.supervisorDedupe.openCountAfterCycles).toBe(1);
      expect(evidence.dod.supervisorNoDuplicate).toBe(true);
    });

    it("3. Worker Failure — stale RUNNING → recover → reclaim", () => {
      expect(evidence.workerFailure.statusForcedRunning).toBe("RUNNING");
      expect(evidence.workerFailure.recoveredCount).toBeGreaterThanOrEqual(1);
      expect(evidence.workerFailure.statusAfterStaleRecover).toBe("QUEUED");
      expect(evidence.workerFailure.recoveredEvent).toBe(true);
      expect(evidence.workerFailure.claimedAfterRecover).toBe(true);
      expect(["RUNNING", "WAITING", "COMPLETED"]).toContain(
        evidence.workerFailure.statusAfterReclaim,
      );
      expect(evidence.dod.workerStaleReclaim).toBe(true);
    });

    it("3. Worker Failure — fail → requeue", () => {
      expect(evidence.workerFailure.failRequeued).toBe(true);
      expect(evidence.workerFailure.requeuedEvent).toBe(true);
      expect(evidence.dod.workerFailRequeue).toBe(true);
    });

    it("DoD operacional de resiliencia — allPassed", () => {
      expect(evidence.dod.allPassed).toBe(true);
    });
  },
);

describe("Operational Resilience Proof — probe ambiente", () => {
  it("reporta motivo quando ambiente real nao esta pronto", () => {
    if (READY.ok) {
      expect(READY.nexoId).toBeTruthy();
      return;
    }
    expect(READY.reason).toBeTruthy();
    console.warn(`[operational-resilience] skip suite real: ${READY.reason}`);
  });
});
