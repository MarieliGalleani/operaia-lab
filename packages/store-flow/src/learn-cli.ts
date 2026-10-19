/**
 * Aprende com o relatorio do portal de afiliados.
 *
 *   pnpm --filter @operaia/store-flow aprender -- rodada.json relatorio.csv [--saida aprendizado.json]
 *
 * Depois, passe o aprendizado na proxima rodada:
 *   pnpm --filter @operaia/store-flow run:csv -- produtos.csv ... --aprendizado aprendizado.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { learnFromResults, parseResultsCsv } from "./learning.js";
import type { StoreFlowRun } from "./types.js";

const args = process.argv.slice(2).filter((a) => a !== "--");
const runPath = args.find((a) => a.endsWith(".json") && args[args.indexOf(a) - 1] !== "--saida");
const csvPath = args.find((a) => a.endsWith(".csv"));
const outIndex = args.indexOf("--saida");
const out = outIndex >= 0 ? args[outIndex + 1]! : "aprendizado.json";

if (!runPath || !csvPath) {
  console.error("Uso: aprender -- rodada.json relatorio.csv [--saida aprendizado.json]");
  process.exit(1);
}

const run = JSON.parse(readFileSync(runPath, "utf8")) as StoreFlowRun;
const report = learnFromResults(run.drafts, parseResultsCsv(readFileSync(csvPath, "utf8")));
writeFileSync(out, JSON.stringify(report, null, 2));
for (const line of report.insights) console.log(`• ${line}`);
console.log(`Aprendizado salvo em ${out}`);
