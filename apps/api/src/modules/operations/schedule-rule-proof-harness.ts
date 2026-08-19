/**
 * F6.2 — prova real de ScheduleRule recorrente (Postgres isolado).
 */
import "./ensure-database-url.js";
import { assertProofDatabaseIsSafe } from "./assert-proof-database-safe.js";
import { prisma } from "@operaia/database";
import { MissionOrchestrator } from "../employees/mission-orchestrator.js";
import {
  createRealAssistedQueueBundle,
  disposeRealAssistedQueueBundle,
  probeRealQueueReady,
} from "./assisted-queue-real-harness.js";

export interface ScheduleRuleProofEvidence {
  readonly capturedAt: string;
  readonly ruleId: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly firstTick: {
    readonly inspected: number;
    readonly due: number;
    readonly enqueued: number;
    readonly deduped: number;
  };
  readonly secondTick: {
    readonly inspected: number;
    readonly due: number;
    readonly enqueued: number;
    readonly deduped: number;
  };
  readonly dedupeTick: {
    readonly inspected: number;
    readonly due: number;
    readonly enqueued: number;
    readonly deduped: number;
  };
  readonly thirdTick: {
    readonly inspected: number;
    readonly due: number;
    readonly enqueued: number;
    readonly deduped: number;
  };
  readonly missionCountAfterFirst: number;
  readonly missionCountAfterSecond: number;
  readonly missionCountAfterDedupe: number;
  readonly missionCountAfterThird: number;
  readonly latchCountBefore: number;
  readonly latchCountAfter: number;
  readonly coordinationCreatedByLatch: number;
  readonly orchestratorCalled: boolean;
  readonly lastEnqueuedAtSet: boolean;
  readonly pathBChecks: {
    readonly missionKindCoordinate: boolean;
    readonly parentMissionIdNull: boolean;
    readonly objectiveMatches: boolean;
  };
  readonly allPassed: boolean;
}

async function countObjectiveMissions(
  workspaceId: string,
  objective: string,
): Promise<number> {
  return prisma.mission.count({
    where: {
      workspaceId,
      missionKind: "COORDINATE",
      objective,
      parentMissionId: null,
    },
  });
}

export async function runScheduleRuleProof(): Promise<ScheduleRuleProofEvidence> {
  assertProofDatabaseIsSafe("schedule-rule-proof-harness");
  const probe = await probeRealQueueReady();
  if (!probe.ok || !probe.nexoId) {
    throw new Error(probe.reason ?? "Ambiente real indisponivel");
  }

  const stamp = Date.now();
  const objective = `F6.2 schedule rule proof ${stamp}`;
  const workspaceId = probe.nexoId;
  let orchestratorCalled = false;

  const originalRun = MissionOrchestrator.prototype.run;
  MissionOrchestrator.prototype.run = async function (...args) {
    orchestratorCalled = true;
    return originalRun.apply(this, args);
  };

  const latchCountBefore = await prisma.coordinationSignalLatch.count();

  const rule = await prisma.scheduleRule.create({
    data: {
      workspaceId,
      intervalSec: 60,
      enabled: true,
      configJson: { objective },
    },
  });

  const bundle = await createRealAssistedQueueBundle();

  try {
    const firstTick = await bundle.continuous.scheduler.runScheduleRulesCycle();
    const missionCountAfterFirst = await countObjectiveMissions(
      workspaceId,
      objective,
    );

    const secondTick = await bundle.continuous.scheduler.runScheduleRulesCycle();
    const missionCountAfterSecond = await countObjectiveMissions(
      workspaceId,
      objective,
    );

    await prisma.scheduleRule.update({
      where: { id: rule.id },
      data: { lastEnqueuedAt: new Date(Date.now() - 120_000) },
    });
    const dedupeTick = await bundle.continuous.scheduler.runScheduleRulesCycle();
    const missionCountAfterDedupe = await countObjectiveMissions(
      workspaceId,
      objective,
    );

    await prisma.mission.updateMany({
      where: {
        workspaceId,
        objective,
        missionKind: "COORDINATE",
        status: { in: ["CREATED", "QUEUED", "RUNNING", "WAITING"] },
      },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        progress: 100,
      },
    });
    await prisma.scheduleRule.update({
      where: { id: rule.id },
      data: { lastEnqueuedAt: new Date(Date.now() - 120_000) },
    });

    const thirdTick = await bundle.continuous.scheduler.runScheduleRulesCycle();
    const missionCountAfterThird = await countObjectiveMissions(
      workspaceId,
      objective,
    );

    const updatedRule = await prisma.scheduleRule.findUniqueOrThrow({
      where: { id: rule.id },
    });

    const sampleMission = await prisma.mission.findFirst({
      where: { workspaceId, objective, missionKind: "COORDINATE" },
      orderBy: { createdAt: "asc" },
    });

    const latchCountAfter = await prisma.coordinationSignalLatch.count();
    const coordinationCreatedByLatch = await prisma.mission.count({
      where: {
        workspaceId,
        missionKind: "COORDINATE",
        createdAt: { gte: new Date(stamp) },
        objective: { contains: "[COORDINATE/" },
      },
    });

    const pathBChecks = {
      missionKindCoordinate: sampleMission?.missionKind === "COORDINATE",
      parentMissionIdNull: sampleMission?.parentMissionId == null,
      objectiveMatches: sampleMission?.objective === objective,
    };

    const allPassed =
      firstTick.inspected >= 1 &&
      firstTick.due >= 1 &&
      firstTick.enqueued === 1 &&
      missionCountAfterFirst === 1 &&
      secondTick.due === 0 &&
      secondTick.enqueued === 0 &&
      missionCountAfterSecond === 1 &&
      dedupeTick.deduped === 1 &&
      dedupeTick.enqueued === 0 &&
      missionCountAfterDedupe === 1 &&
      thirdTick.enqueued === 1 &&
      missionCountAfterThird === 2 &&
      updatedRule.lastEnqueuedAt != null &&
      pathBChecks.missionKindCoordinate &&
      pathBChecks.parentMissionIdNull &&
      pathBChecks.objectiveMatches &&
      !orchestratorCalled &&
      latchCountAfter === latchCountBefore &&
      coordinationCreatedByLatch === 0;

    return {
      capturedAt: new Date().toISOString(),
      ruleId: rule.id,
      workspaceId,
      objective,
      firstTick,
      secondTick,
      dedupeTick,
      thirdTick,
      missionCountAfterFirst,
      missionCountAfterSecond,
      missionCountAfterDedupe,
      missionCountAfterThird,
      latchCountBefore,
      latchCountAfter,
      coordinationCreatedByLatch,
      orchestratorCalled,
      lastEnqueuedAtSet: updatedRule.lastEnqueuedAt != null,
      pathBChecks,
      allPassed,
    };
  } finally {
    MissionOrchestrator.prototype.run = originalRun;
    await prisma.scheduleRule.delete({ where: { id: rule.id } }).catch(() => {});
    await disposeRealAssistedQueueBundle(bundle);
  }
}
