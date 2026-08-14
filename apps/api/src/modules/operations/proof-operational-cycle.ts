/**
 * Evidencia — Operational Cycle Proof (Mission Queue oficial).
 *
 * Uso:
 *   pnpm --filter @operaia/api ops:operational-cycle-proof
 *
 * Requisitos: Postgres (seed NEXO), Docker/infra up.
 * LLM = deterministic (sem chave).
 * Fora de escopo: memoria.
 */
import "./ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "./assert-proof-database-safe.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createRealAssistedQueueBundle,
  disposeRealAssistedQueueBundle,
  probeRealQueueReady,
  runOperationalCycleProof,
} from "./operational-cycle-proof-harness.js";

async function main(): Promise<void> {
  assertProofDatabaseIsSafe("ops:operational-cycle-proof");
  console.log("=== OperaIA.lab — Operational Cycle Proof ===\n");
  console.log(
    "Fluxo: Request → OperationalMissionService → Mission Queue →",
  );
  console.log(
    "Continuous Runtime → Worker claim → COORDINATE → Opera → Delegation →",
  );
  console.log("Mag → EXECUTE → CONSOLIDATE → COMPLETED\n");

  const probe = await probeRealQueueReady();
  if (!probe.ok) {
    throw new Error(
      `Ambiente indisponivel: ${probe.reason}\n` +
        "Suba Postgres (pnpm infra:up) e rode pnpm db:migrate && pnpm db:seed",
    );
  }

  const bundle = await createRealAssistedQueueBundle();

  try {
    const evidence = await runOperationalCycleProof(bundle);

    console.log("\n--- Boot (Continuous Runtime) ---\n");
    console.log(JSON.stringify(evidence.boot, null, 2));

    console.log("\n--- Ask (POST /employees/:id/ask) ---\n");
    console.log(
      JSON.stringify(
        {
          rootMissionId: evidence.ask.rootMissionId,
          status: evidence.ask.rootStatus,
          owner: evidence.ask.rootOwnerEmployeeId,
          hasInitial: evidence.ask.rootHasInitial,
          hasFinal: evidence.ask.rootHasFinal,
          executes: evidence.ask.executeChildren,
          consolidates: evidence.ask.consolidateChildren,
          eventSample: evidence.ask.eventTypes.slice(0, 12),
          orchestratorCalled: evidence.ask.orchestratorCalled,
          httpStatusCode: evidence.ask.httpStatusCode,
        },
        null,
        2,
      ),
    );

    console.log("\n--- Operations (POST /operations/missions) ---\n");
    console.log(
      JSON.stringify(
        {
          rootMissionId: evidence.operations.rootMissionId,
          status: evidence.operations.rootStatus,
          owner: evidence.operations.rootOwnerEmployeeId,
          hasInitial: evidence.operations.rootHasInitial,
          hasFinal: evidence.operations.rootHasFinal,
          executes: evidence.operations.executeChildren,
          consolidates: evidence.operations.consolidateChildren,
          eventSample: evidence.operations.eventTypes.slice(0, 12),
          orchestratorCalled: evidence.operations.orchestratorCalled,
          httpStatusCode: evidence.operations.httpStatusCode,
        },
        null,
        2,
      ),
    );

    console.log("\n--- Checklist DoD ---\n");
    console.log(JSON.stringify(evidence.dod, null, 2));

    if (!evidence.dod.allPassed) {
      throw new Error(
        "Operational Cycle Proof FALHOU — ver checklist DoD acima",
      );
    }

    const opsDir = resolve(process.cwd(), ".ops");
    await mkdir(opsDir, { recursive: true });
    const outPath = resolve(opsDir, "last-operational-cycle-proof.json");
    await writeFile(outPath, JSON.stringify(evidence, null, 2), "utf8");
    console.log(`\nEvidencia salva em: ${outPath}`);
    console.log("\nOK — Queue e o coracao operacional real (ciclo completo).");
  } finally {
    await disposeRealAssistedQueueBundle(bundle);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
