/**
 * Ciclo operacional assistido — missao NEXO controlada.
 *
 * Uso:
 *   pnpm --filter @operaia/api ops:nexo
 *
 * Por padrao usa Deterministic (seguro sem chave).
 * Com LLM real: OPS_USE_REAL_LLM=true e GEMINI_API_KEY no .env
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseLLMProviderList } from "@operaia/ai-core";
import {
  createOperationalRuntime,
  NEXO_OPERATIONAL_MISSION,
} from "./operational-composition.js";

async function main(): Promise<void> {
  const useReal = process.env.OPS_USE_REAL_LLM === "true";

  const runtime = useReal
    ? createOperationalRuntime({
        stack: {
          provider: (process.env.LLM_PROVIDER as "gemini") ?? "gemini",
          model: process.env.LLM_MODEL ?? "gemini-2.5-flash",
          geminiApiKey: process.env.GEMINI_API_KEY,
          openaiApiKey: process.env.OPENAI_API_KEY,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          openRouterApiKey: process.env.OPENROUTER_API_KEY,
          fallbackProviders: parseLLMProviderList(
            process.env.LLM_FALLBACK_PROVIDERS,
          ),
        },
      })
    : createOperationalRuntime({ deterministic: true });

  console.log("=== OperaIA.lab — Operacao Assistida (NEXO) ===");
  console.log(`Provider: ${useReal ? "env/LLM_PROVIDER" : "deterministic"}`);
  console.log(`Objetivo: ${NEXO_OPERATIONAL_MISSION.objective}`);

  const run = await runtime.service.run({ ...NEXO_OPERATIONAL_MISSION });

  console.log("\n--- Resposta utilizavel (Opera) ---\n");
  console.log(run.usableResult);

  console.log("\n--- Workflow ---");
  for (const step of run.workflow.steps) {
    console.log(`  [${step.stage}] ${step.actorId}: ${step.detail}`);
  }

  console.log("\n--- Delegacoes ---");
  for (const item of run.mission.initial.output.decision.delegations) {
    console.log(`  → ${item.specialization}: ${item.reason}`);
  }

  console.log("\n--- Especialistas ---");
  for (const outcome of run.mission.outcomes) {
    console.log(
      `  ${outcome.matched ? "OK" : "NO"} ${outcome.request.specialization}` +
        (outcome.employeeId ? ` (${outcome.employeeId})` : ""),
    );
  }

  console.log(`\n--- LLM events: ${run.llmEvents.length} ---`);
  console.log(`--- Lacunas: ${run.gaps.length} ---`);
  for (const gap of run.gaps) {
    console.log(`  [${gap.severity}] ${gap.code}: ${gap.message}`);
  }

  const opsDir = resolve(process.cwd(), ".ops");
  await mkdir(opsDir, { recursive: true });
  const outPath = resolve(opsDir, "last-nexo-run.json");
  await writeFile(
    outPath,
    JSON.stringify(
      {
        id: run.id,
        workspaceId: run.workspaceId,
        objective: run.objective,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        usableResult: run.usableResult,
        reply: run.reply,
        workflow: run.workflow,
        gaps: run.gaps,
        llmEvents: run.llmEvents,
        decisions: run.mission.initial.output.decision,
        specialists: run.mission.outcomes.map((outcome) => ({
          matched: outcome.matched,
          employeeId: outcome.employeeId,
          specialization: outcome.request.specialization,
          summary: outcome.result?.output.report.summary,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nRegistro salvo em: ${outPath}`);
}

main().catch((error: unknown) => {
  console.error("Falha na missao operacional NEXO:", error);
  process.exitCode = 1;
});
