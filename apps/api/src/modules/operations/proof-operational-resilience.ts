/**
 * Evidencia — Operational Resilience Proof (restart / dedupe / reclaim).
 *
 * Uso:
 *   pnpm --filter @operaia/api ops:operational-resilience-proof
 *
 * Requisitos: Postgres (seed NEXO), Docker/infra up.
 * LLM = deterministic (sem chave).
 * Fora de escopo: memoria, remocao do Path A.
 */
import "./ensure-database-url.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createResilienceQueueBundle,
  disposeResilienceQueueBundle,
  probeRealQueueReady,
  runOperationalResilienceProof,
} from "./operational-resilience-proof-harness.js";

async function main(): Promise<void> {
  console.log("=== OperaIA.lab — Operational Resilience Proof ===\n");
  console.log("Cenarios: Restart Recovery | Supervisor Dedupe | Worker Failure\n");

  const probe = await probeRealQueueReady();
  if (!probe.ok) {
    throw new Error(
      `Ambiente indisponivel: ${probe.reason}\n` +
        "Suba Postgres (pnpm infra:up) e rode pnpm db:migrate && pnpm db:seed",
    );
  }

  const bundle = await createResilienceQueueBundle();

  try {
    const evidence = await runOperationalResilienceProof(bundle);

    console.log("\n--- 1. Restart Recovery ---\n");
    console.log(JSON.stringify(evidence.restart, null, 2));

    console.log("\n--- 2. Supervisor Deduplication ---\n");
    console.log(JSON.stringify(evidence.supervisorDedupe, null, 2));

    console.log("\n--- 3. Worker Failure ---\n");
    console.log(JSON.stringify(evidence.workerFailure, null, 2));

    console.log("\n--- Checklist DoD ---\n");
    console.log(JSON.stringify(evidence.dod, null, 2));

    const opsDir = resolve(process.cwd(), ".ops");
    await mkdir(opsDir, { recursive: true });
    const outPath = resolve(opsDir, "last-operational-resilience-proof.json");
    await writeFile(outPath, JSON.stringify(evidence, null, 2), "utf8");
    console.log(`\nEvidencia salva em: ${outPath}`);

    if (!evidence.dod.allPassed) {
      throw new Error(
        "Operational Resilience Proof FALHOU — ver checklist DoD acima",
      );
    }

    console.log("\nOK — operacao continua e confiavel sob falha.");
  } finally {
    await disposeResilienceQueueBundle(bundle);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
