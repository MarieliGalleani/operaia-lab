/**
 * Integration — producer P0 enfileira follow-up real via MissionQueue.
 */
import "../operations/ensure-database-url.js";
import { MissionStatus, prisma } from "@operaia/database";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MissionQueue } from "./mission-queue.js";
import {
  buildTechnicalFollowUpObjective,
  enqueueTechnicalFollowUpIfEligible,
  FOLLOW_UP_DELEGATE_MARKER,
  FOLLOW_UP_ENQUEUED_MISSION_EVENT_TYPE,
} from "./queued-mission-executor.js";
import { asJson, type ExecutePhaseResult } from "./mission-result-store.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "./mission-states.js";

const PREFIX = `fu-p0-${Date.now()}`;
const WS = `${PREFIX}-ws`;

const noopLogger = {
  info() {},
  warn() {},
  error() {},
};

describe("P0 follow-up producer — MissionQueue real", () => {
  const queue = new MissionQueue();

  beforeEach(async () => {
    await prisma.missionEvent.deleteMany({
      where: { mission: { workspaceId: { startsWith: PREFIX } } },
    });
    await prisma.mission.deleteMany({
      where: { workspaceId: { startsWith: PREFIX } },
    });
  });

  afterAll(async () => {
    await prisma.missionEvent.deleteMany({
      where: { mission: { workspaceId: { startsWith: PREFIX } } },
    });
    await prisma.mission.deleteMany({
      where: { workspaceId: { startsWith: PREFIX } },
    });
    await prisma.$disconnect();
  });

  it("EXECUTE technical_analysis DELIVERED → 1 COORDINATE follow-up; 2a chamada nao duplica", async () => {
    const { mission: root } = await queue.enqueue({
      workspaceId: WS,
      objective: `[COORDINATE/backlog] ${PREFIX} root`,
      missionKind: MissionKind.COORDINATE,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: true,
    });
    const { mission: execute } = await queue.enqueue({
      workspaceId: WS,
      objective: "Analisar repositorio",
      missionKind: MissionKind.EXECUTE,
      parentMissionId: root.id,
      requiredSpecialization: "SOFTWARE_ENGINEERING",
      ownerEmployeeId: "cto-mag",
      dedupe: false,
    });

    const delivery: NonNullable<ExecutePhaseResult["delivery"]> = {
      type: "technical_analysis",
      status: "DELIVERED",
      missionId: execute.id,
      employeeId: "cto-mag",
      objective: execute.objective,
      summary: "Repo TypeScript monorepo",
      findings: ["Raiz com 11 entradas"],
      evidence: [{ source: "listDirectory", data: { entryCount: 11 } }],
      recommendations: ["Revisar acoplamento"],
      deliveredAt: new Date().toISOString(),
    };

    await prisma.mission.update({
      where: { id: execute.id },
      data: {
        status: MissionStatus.COMPLETED,
        resultJson: asJson({
          phase: "executed",
          employeeResult: {
            employeeId: "cto-mag",
            output: {
              decision: {
                analyzed: "ok",
                decision: "ok",
                reasoning: "ok",
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
        progress: 100,
        finishedAt: new Date(),
      },
    });

    const source = await queue.get(execute.id);
    expect(source?.status).toBe(MissionStatus.COMPLETED);

    const first = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: source!,
      delivery,
    });
    expect(first?.created).toBe(true);

    const expectedObjective = buildTechnicalFollowUpObjective(execute.id);
    expect(expectedObjective).toContain(`[SOURCE_EXECUTE:${execute.id}]`);
    expect(expectedObjective).toContain(FOLLOW_UP_DELEGATE_MARKER);

    const followUps = await prisma.mission.findMany({
      where: {
        workspaceId: WS,
        missionKind: "COORDINATE",
        objective: expectedObjective,
      },
    });
    expect(followUps).toHaveLength(1);
    expect(followUps[0]?.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
    expect(followUps[0]?.workspaceId).toBe(WS);

    const events = await prisma.missionEvent.findMany({
      where: {
        missionId: execute.id,
        type: FOLLOW_UP_ENQUEUED_MISSION_EVENT_TYPE,
      },
    });
    expect(events).toHaveLength(1);

    const second = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: source!,
      delivery,
    });
    expect(second).toBeNull();

    const again = await prisma.mission.findMany({
      where: {
        workspaceId: WS,
        missionKind: "COORDINATE",
        objective: expectedObjective,
      },
    });
    expect(again).toHaveLength(1);
  });

  it("parent ja FOLLOW_UP_DELEGATE nao gera cadeia B→C", async () => {
    const sourceId = `${PREFIX}-depth-src`;
    const { mission: parent } = await queue.enqueue({
      workspaceId: WS,
      objective: buildTechnicalFollowUpObjective(sourceId),
      missionKind: MissionKind.COORDINATE,
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: true,
    });
    const { mission: execute } = await queue.enqueue({
      workspaceId: WS,
      objective: "Investigar follow-up",
      missionKind: MissionKind.EXECUTE,
      parentMissionId: parent.id,
      requiredSpecialization: "SOFTWARE_ENGINEERING",
      ownerEmployeeId: "cto-mag",
      dedupe: false,
    });

    const delivery: NonNullable<ExecutePhaseResult["delivery"]> = {
      type: "technical_analysis",
      status: "DELIVERED",
      missionId: execute.id,
      employeeId: "cto-mag",
      objective: execute.objective,
      summary: "mais findings",
      findings: ["novo achado"],
      evidence: [{ source: "readRepository", data: { ok: true } }],
      recommendations: ["seguir"],
      deliveredAt: new Date().toISOString(),
    };

    await prisma.mission.update({
      where: { id: execute.id },
      data: {
        status: MissionStatus.COMPLETED,
        resultJson: asJson({
          phase: "executed",
          employeeResult: {
            employeeId: "cto-mag",
            output: {
              decision: {
                analyzed: "ok",
                decision: "ok",
                reasoning: "ok",
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
        progress: 100,
        finishedAt: new Date(),
      },
    });

    const source = await queue.get(execute.id);
    const result = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: source!,
      delivery,
    });
    expect(result).toBeNull();

    const childFollowUps = await prisma.mission.findMany({
      where: {
        workspaceId: WS,
        objective: buildTechnicalFollowUpObjective(execute.id),
      },
    });
    expect(childFollowUps).toHaveLength(0);
  });
});
