/**
 * F6.2 — Prova CLI de ScheduleRule recorrente.
 *
 * Uso:
 *   DATABASE_URL=…/operaia_lab_proof pnpm --filter @operaia/api ops:schedule-rule-proof
 */
import "./ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "./assert-proof-database-safe.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "@operaia/database";
import { runScheduleRuleProof } from "./schedule-rule-proof-harness.js";

async function main(): Promise<void> {
  assertProofDatabaseIsSafe("ops:schedule-rule-proof");
  console.log("=== OperaIA.lab — F6.2 ScheduleRule Proof ===\n");

  const evidence = await runScheduleRuleProof();
  console.log("\n--- Evidencia ---\n");
  console.log(JSON.stringify(evidence, null, 2));

  const opsDir = resolve(process.cwd(), ".ops");
  await mkdir(opsDir, { recursive: true });
  const outPath = resolve(opsDir, "last-schedule-rule-proof.json");
  await writeFile(outPath, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`\nEvidencia salva em: ${outPath}`);

  if (!evidence.allPassed) {
    throw new Error("F6.2 ScheduleRule Proof FALHOU — ver evidencia acima");
  }

  console.log("\nOK — ScheduleRule gera COORDINATE recorrente sem latch/Path A.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
