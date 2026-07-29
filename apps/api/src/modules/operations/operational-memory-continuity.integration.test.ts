/**
 * Operational Memory Continuity Proof — integracao real M1.
 * Skip se Postgres/NEXO indisponivel.
 */
import "./ensure-database-url.js";
import { describe, expect, it } from "vitest";
import {
  probeRealQueueReady,
  runOperationalMemoryContinuityProof,
} from "./operational-memory-continuity-proof-harness.js";

const READY = await probeRealQueueReady();

describe.skipIf(!READY.ok)(
  "Operational Memory Continuity Proof — M1 ponta a ponta",
  () => {
    it(
      "missao Queue → notes → restart → briefing com memoria + isolamento",
      async () => {
        const evidence = await runOperationalMemoryContinuityProof();

        console.log(
          "[memory-continuity-proof] DoD",
          JSON.stringify(evidence.dod, null, 2),
        );

        expect(evidence.firstMissionStatus).toBe("completed");
        expect(evidence.notesAfterFirstMission).toBeGreaterThanOrEqual(1);
        expect(evidence.summaryNotesForMission).toBeGreaterThanOrEqual(1);

        expect(evidence.dod.memoryPersistsAfterRestart).toBe(true);
        expect(evidence.notesAfterRestart.length).toBeGreaterThan(0);
        expect(
          evidence.notesAfterRestart.some((n) => n.includes(evidence.marker)) ||
            evidence.notesAfterRestart.some((n) => n.includes("Resumo:")),
        ).toBe(true);

        expect(evidence.dod.briefingRecoversMemory).toBe(true);
        expect(evidence.briefingMemoryNotes.length).toBeGreaterThan(0);

        expect(evidence.dod.noDuplicates).toBe(true);
        expect(evidence.duplicateContents).toEqual([]);

        expect(evidence.dod.noCrossWorkspaceLeak).toBe(true);
        expect(
          evidence.notesAfterRestart.some((n) =>
            n.includes(evidence.leakToken),
          ),
        ).toBe(false);
        expect(
          evidence.briefingMemoryNotes.some((n) =>
            n.includes(evidence.leakToken),
          ),
        ).toBe(false);

        expect(evidence.dod.allPassed).toBe(true);
      },
      300_000,
    );
  },
);

describe("Operational Memory Continuity Proof — probe", () => {
  it("reporta motivo quando ambiente real nao esta pronto", () => {
    if (READY.ok) {
      expect(READY.nexoId).toBeTruthy();
      return;
    }
    expect(READY.reason).toBeTruthy();
    console.warn(`[memory-continuity] skip suite real: ${READY.reason}`);
  });
});
