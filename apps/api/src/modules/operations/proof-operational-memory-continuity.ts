/**
 * Evidencia — Operational Memory Continuity Proof (M1).
 *
 * Uso:
 *   pnpm --filter @operaia/api ops:operational-memory-continuity-proof
 *
 * Requisitos: Postgres (seed NEXO), migration M1 aplicada.
 * LLM = deterministic. Sem M2. Sem mudanca de TTL/quota.
 */
import "./ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "./assert-proof-database-safe.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  probeRealQueueReady,
  runOperationalMemoryContinuityProof,
} from "./operational-memory-continuity-proof-harness.js";

async function main(): Promise<void> {
  assertProofDatabaseIsSafe("ops:operational-memory-continuity-proof");
  console.log("=== OperaIA.lab — Operational Memory Continuity Proof ===\n");
  console.log(
    "Fluxo: Missao Queue → OperationalMemoryNote → restart → nova missao → briefing\n",
  );

  const probe = await probeRealQueueReady();
  if (!probe.ok) {
    throw new Error(
      `Ambiente indisponivel: ${probe.reason}\n` +
        "Suba Postgres (pnpm infra:up) e rode pnpm db:migrate && pnpm db:seed",
    );
  }

  const evidence = await runOperationalMemoryContinuityProof();

  console.log("\n--- Primeira missao (Queue) ---\n");
  console.log(
    JSON.stringify(
      {
        missionId: evidence.firstMissionId,
        status: evidence.firstMissionStatus,
        notesAfterFirstMission: evidence.notesAfterFirstMission,
        summaryNotes: evidence.summaryNotesForMission,
        learningNotes: evidence.learningNotesForMission,
      },
      null,
      2,
    ),
  );

  console.log("\n--- Apos restart (loadOperationalMemoryNotes) ---\n");
  console.log(
    JSON.stringify(
      {
        count: evidence.notesAfterRestart.length,
        sample: evidence.notesAfterRestart.slice(0, 3),
      },
      null,
      2,
    ),
  );

  console.log("\n--- Briefing (memoryContext) ---\n");
  console.log(
    JSON.stringify(
      {
        secondMissionId: evidence.secondMissionId,
        count: evidence.briefingMemoryNotes.length,
        sample: evidence.briefingMemoryNotes.slice(0, 3),
      },
      null,
      2,
    ),
  );

  console.log("\n--- Isolamento / dedupe ---\n");
  console.log(
    JSON.stringify(
      {
        foreignWorkspaceId: evidence.foreignWorkspaceId,
        leakToken: evidence.leakToken,
        duplicateContents: evidence.duplicateContents,
      },
      null,
      2,
    ),
  );

  console.log("\n--- Checklist DoD ---\n");
  console.log(JSON.stringify(evidence.dod, null, 2));

  const opsDir = resolve(process.cwd(), ".ops");
  await mkdir(opsDir, { recursive: true });
  const outPath = resolve(opsDir, "last-operational-memory-continuity-proof.json");
  await writeFile(outPath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`\nEvidencia salva em: ${outPath}`);

  if (!evidence.dod.allPassed) {
    throw new Error(
      "Operational Memory Continuity Proof FALHOU — ver checklist DoD",
    );
  }

  console.log("\nOK — memoria operacional M1 continua apos restart.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
