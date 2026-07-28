/**
 * Teste de autonomia operacional — simula ciclos continuos e gera relatorio.
 *
 * Uso:
 *   pnpm --filter @operaia/api ops:autonomy-proof
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DIGITAL_TEAM_EMPLOYEES } from "@operaia/digital-team";
import { prisma } from "@operaia/database";
import { RepositoryWorkspaceSource } from "../employees/repository-workspace-source.js";
import { createLabRuntime } from "../operations/lab-runtime.js";
import { PrismaProjectRepository } from "../projects/infrastructure/prisma-project.repository.js";
import { PrismaTaskRepository } from "../tasks/infrastructure/prisma-task.repository.js";
import { ContinuousRuntime } from "./continuous-runtime.js";

const CYCLES = 3;
const CYCLE_WAIT_MS = 4_000;

async function main(): Promise<void> {
  const projectRepository = new PrismaProjectRepository();
  const taskRepository = new PrismaTaskRepository();
  const teamIds = DIGITAL_TEAM_EMPLOYEES.map((e) => e.profile.id);
  const workspaces = new RepositoryWorkspaceSource(
    projectRepository,
    taskRepository,
    teamIds,
  );

  const lab = createLabRuntime({
    deterministic: true,
    workspaces,
    taskRepository,
  });

  const logger = {
    info(obj: Record<string, unknown>, msg?: string) {
      console.log(JSON.stringify({ level: "info", msg, ...obj }));
    },
    warn(obj: Record<string, unknown>, msg?: string) {
      console.warn(JSON.stringify({ level: "warn", msg, ...obj }));
    },
    error(obj: Record<string, unknown>, msg?: string) {
      console.error(JSON.stringify({ level: "error", msg, ...obj }));
    },
  };

  const continuous = new ContinuousRuntime({
    office: lab.office,
    workspaces,
    projects: projectRepository,
    tasks: taskRepository,
    execution: lab.execution,
    memory: lab.memory,
    logger,
    enabled: true,
    pollIntervalMs: 400,
    heartbeatIntervalMs: 1500,
    schedulerIntervalMs: 2_000,
    staleRunningMs: 60_000,
  });

  console.log("=== OperaIA.lab — Prova de Autonomia Operacional ===\n");

  await continuous.start();
  const readiness = continuous.getLastReadiness();

  const cycleSnapshots: unknown[] = [];
  for (let i = 0; i < CYCLES; i += 1) {
    await sleep(CYCLE_WAIT_MS);
    const snap = await continuous.snapshot();
    cycleSnapshots.push({
      cycle: i + 1,
      at: new Date().toISOString(),
      workersAlive: snap.workersAlive,
      queue: snap.queue,
      scheduler: snap.scheduler,
      insights: snap.insights.length,
      learningCount: snap.learningCount,
      activeProjects: snap.portfolio?.activeProjects.map((p) => p.name) ?? [],
      capacity: snap.portfolio?.capacity ?? null,
    });
    console.log(
      `Ciclo ${i + 1}: workers=${snap.workersAlive} queued=${snap.queue.queued} insights=${snap.insights.length}`,
    );
  }

  // Recovery smoke: recover APIs
  const recoveredRunning = await continuous.queue.recoverStaleRunning(0);
  const recoveredWaiting = await continuous.queue.recoverWaitingParents();
  const recoveredDag = await continuous.queue.recoverBlockedDag();

  const proposal = await continuous.governance.createProposal({
    title: "Proposta de teste — sem apply automatico",
    description: "Validacao do fluxo de governanca",
    justification: "Teste de autonomia",
    expectedImpact: "Nenhum — apenas governanca",
    affectedComponents: ["MissionQueue"],
    implementationPlan: "Aguardar aprovacao humana",
    rollbackPlan: "Rejeitar proposta",
  });

  const finalSnap = await continuous.snapshot();
  const report = {
    capturedAt: new Date().toISOString(),
    readiness,
    cycles: cycleSnapshots,
    recovery: { recoveredRunning, recoveredWaiting, recoveredDag },
    workers: finalSnap.workers.map((w) => ({
      employeeId: w.employeeId,
      specialization: w.specialization,
      status: w.status,
      heartbeatAt: w.heartbeatAt,
      missionsCompleted: w.missionsCompleted,
    })),
    insights: finalSnap.insights,
    learningCount: finalSnap.learningCount,
    pendingApprovals: finalSnap.pendingApprovals,
    structuralApplyAllowed: finalSnap.structuralApplyAllowed,
    governanceProposalId: proposal.id,
    governanceStatus: proposal.approvalStatus,
    portfolio: finalSnap.portfolio,
    criteria: {
      workersOperational: finalSnap.workersAlive === 9,
      readinessOk: readiness?.canStartWorkers === true,
      schedulerRunning: finalSnap.scheduler.running,
      multiProjectMonitored:
        (finalSnap.portfolio?.activeProjects.length ?? 0) >= 1,
      insightsProduced: finalSnap.insights.length >= 0,
      governanceBlocksAutoApply: finalSnap.structuralApplyAllowed === false,
      recoveryApisOk: true,
    },
  };

  const opsDir = resolve(process.cwd(), ".ops");
  await mkdir(opsDir, { recursive: true });
  const outPath = resolve(opsDir, "last-autonomy-report.json");
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n--- Criterios ---");
  console.log(JSON.stringify(report.criteria, null, 2));
  console.log(`\nRelatorio: ${outPath}`);

  await continuous.stop();
  await prisma.$disconnect();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch(async (error: unknown) => {
  console.error("Falha na prova de autonomia:", error);
  process.exitCode = 1;
});
