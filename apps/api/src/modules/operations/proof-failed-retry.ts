/**
 * F6.1 — Prova CLI de retry automatico de FAILED.
 *
 * Uso:
 *   DATABASE_URL=…/operaia_lab_proof pnpm --filter @operaia/api ops:failed-retry-proof
 */
import "./ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "./assert-proof-database-safe.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@operaia/database";
import { runFailedRetryProof } from "./failed-retry-proof-harness.js";

async function main(): Promise<void> {
  assertProofDatabaseIsSafe("ops:failed-retry-proof");
  console.log("=== OperaIA.lab — F6.1 Failed Retry Proof ===\n");

  const evidence = await runFailedRetryProof();
  console.log("\n--- Evidencia ---\n");
  console.log(JSON.stringify(evidence, null, 2));

  const opsDir = resolve(process.cwd(), ".ops");
  await mkdir(opsDir, { recursive: true });
  const outPath = resolve(opsDir, "last-failed-retry-proof.json");
  await writeFile(outPath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`\nEvidencia salva em: ${outPath}`);

  if (!evidence.allPassed) {
    throw new Error("F6.1 Failed Retry Proof FALHOU — ver evidencia acima");
  }

  console.log("\nOK — FAILED elegivel reenfileirado sem COORDINATE duplicado.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
