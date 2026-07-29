/**
 * Evidencia — Assisted Execution via MissionQueue real (ADR-007 Fase 2.2c).
 *
 * Uso:
 *   pnpm --filter @operaia/api ops:assisted-queue-proof
 *
 * Requisitos: Postgres (seed NEXO), Docker/infra up.
 * LLM = deterministic (sem chave).
 */
import "./ensure-database-url.js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createRealAssistedQueueBundle,
  disposeRealAssistedQueueBundle,
  probeRealQueueReady,
  runAssistedMissionOnRealQueue,
} from "./assisted-queue-real-harness.js";

async function main(): Promise<void> {
  console.log("=== OperaIA.lab — Prova Assisted → MissionQueue real ===\n");

  const probe = await probeRealQueueReady();
  if (!probe.ok) {
    throw new Error(
      `Ambiente indisponivel: ${probe.reason}\n` +
        "Suba Postgres (pnpm infra:up) e rode pnpm db:migrate && pnpm db:seed",
    );
  }

  const bundle = await createRealAssistedQueueBundle();
  const objective =
    `Fase 2.2c Assisted real: autenticacao NEXO (${new Date().toISOString()})`;

  try {
    console.log(`preferQueue=${bundle.service.prefersQueue}`);
    console.log(`workersAlive(antes start via harness)=pending`);
    console.log(`workspace=${bundle.nexoName} (${bundle.nexoWorkspaceId})`);
    console.log(`objective=${objective}\n`);

    const { run, evidence, orchestratorCalled } =
      await runAssistedMissionOnRealQueue({ bundle, objective });

    console.log("\n--- OperationalRun ---\n");
    console.log(
      JSON.stringify(
        {
          id: run.id,
          status: run.status,
          usableResult: run.usableResult.slice(0, 200),
          outcomes: run.mission.outcomes.map((o) => ({
            matched: o.matched,
            employeeId: o.employeeId,
            specialization: o.request.specialization,
          })),
          orchestratorCalled,
        },
        null,
        2,
      ),
    );

    console.log("\n--- Evidencia Prisma ---\n");
    console.log(
      JSON.stringify(
        {
          rootStatus: evidence.rootStatus,
          rootOwner: evidence.rootOwnerEmployeeId,
          hasInitial: evidence.rootHasInitial,
          hasFinal: evidence.rootHasFinal,
          executes: evidence.executeChildren,
          consolidates: evidence.consolidateChildren,
          eventTypes: evidence.eventTypes,
          learningOnRoot: evidence.learningOnRoot,
          memoryHits: evidence.memoryHits,
        },
        null,
        2,
      ),
    );

    if (orchestratorCalled) {
      throw new Error("Path A MissionOrchestrator foi chamado — flag falhou");
    }
    if (evidence.rootStatus !== "COMPLETED") {
      throw new Error(`Raiz nao COMPLETED: ${evidence.rootStatus}`);
    }
    if (!evidence.rootHasInitial || !evidence.rootHasFinal) {
      throw new Error("resultJson sem initial/final preservados");
    }
    if (evidence.executeChildren.length < 1) {
      throw new Error("Nenhum EXECUTE filho gerado");
    }
    if (evidence.consolidateChildren.every((c) => c.status !== "COMPLETED")) {
      // sem delegacao nao ha CONSOLIDATE filho — so se houve EXECUTE
      if (evidence.executeChildren.some((c) => c.status === "COMPLETED")) {
        throw new Error("EXECUTE completo sem CONSOLIDATE COMPLETED");
      }
    }
    if (!evidence.learningOnRoot) {
      console.warn("WARN: missionLearning ausente na raiz (verificar executor)");
    }

    const opsDir = resolve(process.cwd(), ".ops");
    await mkdir(opsDir, { recursive: true });
    const outPath = resolve(opsDir, "last-assisted-queue-real.json");
    await writeFile(outPath, JSON.stringify(evidence, null, 2), "utf8");
    console.log(`\nEvidencia salva em: ${outPath}`);
    console.log("\nOK — fluxo Assisted real via MissionQueue concluido.");
  } finally {
    await disposeRealAssistedQueueBundle(bundle);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
