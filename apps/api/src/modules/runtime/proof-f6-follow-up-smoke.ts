/**
 * Smoke F6.1 — prova controlada do producer (1 FOLLOW_UP_DELEGATE).
 *
 * Usa MissionQueue real + enqueueTechnicalFollowUpIfEligible (mesmo caminho
 * chamado por QueuedMissionExecutor.runExecute apos DELIVERED).
 * Nao sobe ContinuousRuntime paralelo.
 *
 * Uso:
 *   OPERAIA_PROOF_ALLOW_OPERATIONAL_DB=1 pnpm --filter @operaia/api exec tsx \
 *     --env-file-if-exists=../../.env \
 *     src/modules/runtime/proof-f6-follow-up-smoke.ts
 */
import "../operations/ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "../operations/assert-proof-database-safe.js";
import { prisma } from "@operaia/database";
import { MissionQueue } from "./mission-queue.js";
import {
  buildTechnicalFollowUpObjective,
  enqueueTechnicalFollowUpIfEligible,
  FOLLOW_UP_DELEGATE_MARKER,
  FOLLOW_UP_ENQUEUED_MISSION_EVENT_TYPE,
} from "./queued-mission-executor.js";
import { asJson, type ExecutePhaseResult } from "./mission-result-store.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";

assertProofDatabaseIsSafe("proof-f6-follow-up-smoke");

const STAMP = Date.now();
const WORKSPACE_ID = "operaia-lab";
const PARK_MS = 6 * 60 * 60 * 1000;

const noopLogger = {
  info() {},
  warn() {},
  error() {},
};

async function main(): Promise<void> {
  console.log("=== F6.1 follow-up smoke (producer runtime) ===\n");
  const queue = new MissionQueue();

  const { mission: root } = await queue.enqueue({
    workspaceId: WORKSPACE_ID,
    objective: `[COORDINATE/f6_smoke] F6.1 root ${STAMP}`,
    missionKind: MissionKind.COORDINATE,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    dedupe: false,
    scheduledAt: new Date(Date.now() + PARK_MS),
  });

  const { mission: execute } = await queue.enqueue({
    workspaceId: WORKSPACE_ID,
    objective: `F6.1 smoke EXECUTE technical_analysis ${STAMP}`,
    missionKind: MissionKind.EXECUTE,
    parentMissionId: root.id,
    requiredSpecialization: "SOFTWARE_ENGINEERING",
    ownerEmployeeId: "cto-mag",
    dedupe: false,
    scheduledAt: new Date(Date.now() + PARK_MS),
  });

  const delivery: NonNullable<ExecutePhaseResult["delivery"]> = {
    type: "technical_analysis",
    status: "DELIVERED",
    missionId: execute.id,
    employeeId: "cto-mag",
    objective: execute.objective,
    summary: "Repo TypeScript monorepo (smoke F6.1).",
    findings: ["Raiz com monorepo packages/apps"],
    evidence: [
      {
        source: "listDirectory",
        data: { path: ".", entryCount: 11, smoke: true },
      },
    ],
    recommendations: ["Revisar acoplamento do runtime"],
    deliveredAt: new Date().toISOString(),
  };

  await prisma.mission.update({
    where: { id: execute.id },
    data: {
      status: "COMPLETED",
      progress: 100,
      finishedAt: new Date(),
      resultJson: asJson({
        phase: "executed",
        employeeResult: {
          employeeId: "cto-mag",
          output: {
            decision: {
              analyzed: "ok",
              decision: "ok",
              reasoning: "smoke",
              recommendations: [],
              delegations: [],
              risks: [],
              nextActions: [],
              delivery,
            },
            report: {
              summary: "ok",
              analysis: "ok",
              plan: [],
              recommendations: [],
              risks: [],
              nextActions: [],
            },
            quality: { passed: true, issues: [] },
          },
        },
        delivery,
      } satisfies ExecutePhaseResult),
    },
  });

  const source = await queue.get(execute.id);
  const first = await enqueueTechnicalFollowUpIfEligible({
    queue,
    logger: noopLogger,
    source: source!,
    delivery,
  });
  const second = await enqueueTechnicalFollowUpIfEligible({
    queue,
    logger: noopLogger,
    source: source!,
    delivery,
  });

  const expected = buildTechnicalFollowUpObjective(execute.id);
  const followUps = await prisma.mission.findMany({
    where: { workspaceId: WORKSPACE_ID, objective: expected },
  });
  const events = await prisma.missionEvent.findMany({
    where: {
      missionId: execute.id,
      type: FOLLOW_UP_ENQUEUED_MISSION_EVENT_TYPE,
    },
  });

  const report = {
    executeMissionId: execute.id,
    followUpMissionId: first?.followUpMissionId ?? null,
    created: first?.created ?? false,
    secondNull: second === null,
    followUpCount: followUps.length,
    eventCount: events.length,
    objective: followUps[0]?.objective ?? null,
    ownerEmployeeId: followUps[0]?.ownerEmployeeId ?? null,
    hasFollowUpMarker: Boolean(
      followUps[0]?.objective.includes(FOLLOW_UP_DELEGATE_MARKER),
    ),
    hasSourceExecute: Boolean(
      followUps[0]?.objective.includes(`[SOURCE_EXECUTE:${execute.id}]`),
    ),
    pass:
      first?.created === true &&
      second === null &&
      followUps.length === 1 &&
      events.length === 1 &&
      followUps[0]?.ownerEmployeeId === CEO_EMPLOYEE_ID &&
      Boolean(followUps[0]?.objective.includes(FOLLOW_UP_DELEGATE_MARKER)),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
