/**
 * P0 — gate/idempotencia do producer de follow-up tecnico.
 */
import { describe, expect, it, vi } from "vitest";
import type { Mission } from "@operaia/database";
import {
  buildTechnicalFollowUpObjective,
  enqueueTechnicalFollowUpIfEligible,
  FOLLOW_UP_DELEGATE_MARKER,
  shouldEnqueueTechnicalFollowUp,
} from "./queued-mission-executor.js";
import { hashObjective } from "./mission-queue.js";
import type { MissionQueue } from "./mission-queue.js";
import type { EmployeeWorkerLogger } from "./employee-worker.js";
import type { ExecutePhaseResult } from "./mission-result-store.js";

function delivery(
  overrides: Partial<{
    type: "technical_analysis" | "priority_recommendation";
    status: "DELIVERED" | "FAILED";
    findings: string[];
    evidence: { source: string; data: Record<string, unknown> }[];
  }> = {},
) {
  return {
    type: overrides.type ?? ("technical_analysis" as const),
    status: overrides.status ?? ("DELIVERED" as const),
    missionId: "exec-a",
    employeeId: "cto-mag",
    objective: "Analise",
    summary: "Repo TypeScript",
    findings: overrides.findings ?? ["Raiz com monorepo"],
    evidence: overrides.evidence ?? [
      { source: "listDirectory", data: { entryCount: 11 } },
    ],
    recommendations: ["Revisar acoplamento"],
    deliveredAt: "2026-08-13T00:00:00.000Z",
  };
}

describe("P0 technical follow-up producer", () => {
  it("objective contem SOURCE_EXECUTE + FOLLOW_UP_DELEGATE e e estavel", () => {
    const a = buildTechnicalFollowUpObjective("exec-a");
    const b = buildTechnicalFollowUpObjective("exec-a");
    expect(a).toContain("[SOURCE_EXECUTE:exec-a]");
    expect(a).toContain(FOLLOW_UP_DELEGATE_MARKER);
    expect(a).toBe(b);
    expect(hashObjective("nexo", a)).toBe(hashObjective("nexo", b));
  });

  it("technical_analysis + DELIVERED gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        parentCoordinateObjective: "[COORDINATE/backlog] nexo",
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(true);
  });

  it("workspace hash difere entre workspaces (mesmo objective)", () => {
    const objective = buildTechnicalFollowUpObjective("exec-a");
    expect(hashObjective("nexo", objective)).not.toBe(
      hashObjective("outro", objective),
    );
  });

  it("segunda tentativa do mesmo source nao duplica", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        sourceAlreadyEmittedFollowUp: true,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: true,
      }),
    ).toBe(false);
  });

  it("sem technical_analysis nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery({ type: "priority_recommendation" }),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("sem DELIVERED nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery({ status: "FAILED" }),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("FAILED / sem delivery nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: undefined,
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("GENERAL_CONVERSATION no parent nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        parentCoordinateObjective:
          "[MISSION_INTENT] GENERAL_CONVERSATION|employee:operaia-ceo",
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("limite de profundidade: parent ja FOLLOW_UP_DELEGATE bloqueia", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery(),
        parentCoordinateObjective: buildTechnicalFollowUpObjective("exec-a"),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });

  it("sem evidence ou findings nao gera follow-up", () => {
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery({ evidence: [], findings: ["x"] }),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
    expect(
      shouldEnqueueTechnicalFollowUp({
        delivery: delivery({ findings: [], evidence: [{ source: "t", data: {} }] }),
        sourceAlreadyEmittedFollowUp: false,
        followUpMissionAlreadyExists: false,
      }),
    ).toBe(false);
  });
});

/**
 * P1.2D — follow-up herda a origin da raiz-fonte (queue.get(parentMissionId)),
 * nunca fabrica classificacao. origin = proveniencia, nao mecanismo.
 */
describe("enqueueTechnicalFollowUpIfEligible — origin inheritance (P1.2D)", () => {
  const noopLogger: EmployeeWorkerLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  function sourceMission(overrides: Partial<Mission> = {}): Mission {
    return {
      id: "exec-a",
      workspaceId: "nexo",
      projectId: null,
      parentMissionId: "root-1",
      ...overrides,
    } as unknown as Mission;
  }

  function mockQueue(parent: Partial<Mission> | null) {
    const enqueue = vi.fn().mockResolvedValue({
      mission: { id: "followup-1" },
      created: true,
    });
    const queue = {
      get: vi.fn().mockResolvedValue(parent),
      hasEvent: vi.fn().mockResolvedValue(false),
      findByObjectiveHash: vi.fn().mockResolvedValue(null),
      enqueue,
      appendEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as MissionQueue;
    return { queue, enqueue };
  }

  const deliveredAnalysis: NonNullable<ExecutePhaseResult["delivery"]> = {
    type: "technical_analysis",
    status: "DELIVERED",
    missionId: "exec-a",
    employeeId: "cto-mag",
    objective: "Analise",
    summary: "Repo TypeScript",
    findings: ["Raiz com monorepo"],
    evidence: [{ source: "listDirectory", data: { entryCount: 11 } }],
    recommendations: ["Revisar acoplamento"],
    deliveredAt: "2026-08-13T00:00:00.000Z",
  };

  it("Caso 1 — HUMAN_DEMAND: follow-up herda origin da raiz-fonte", async () => {
    const { queue, enqueue } = mockQueue({
      objective: "[COORDINATE/backlog] nexo",
      origin: "HUMAN_DEMAND",
    });

    const result = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: sourceMission(),
      delivery: deliveredAnalysis,
    });

    expect(result?.created).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "HUMAN_DEMAND" }),
    );
  });

  it("Caso 2 — SCHEDULE_RULE: follow-up herda origin da raiz-fonte (estrutural, mesmo sem ocorrencia observada em producao)", async () => {
    const { queue, enqueue } = mockQueue({
      objective: "[COORDINATE/SCHEDULE] revisar workspace",
      origin: "SCHEDULE_RULE",
    });

    const result = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: sourceMission(),
      delivery: deliveredAnalysis,
    });

    expect(result?.created).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "SCHEDULE_RULE" }),
    );
  });

  it("Caso 3 — SIGNAL_GITHUB: follow-up herda origin da raiz-fonte", async () => {
    const { queue, enqueue } = mockQueue({
      objective: "[COORDINATE/SIGNAL] github.pr.opened",
      origin: "SIGNAL_GITHUB",
    });

    const result = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: sourceMission(),
      delivery: deliveredAnalysis,
    });

    expect(result?.created).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "SIGNAL_GITHUB" }),
    );
  });

  it("Caso 4 — origin desconhecida: parent.origin = null nao fabrica classificacao", async () => {
    const { queue, enqueue } = mockQueue({
      objective: "[COORDINATE/backlog] nexo",
      origin: null,
    });

    const result = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: sourceMission(),
      delivery: deliveredAnalysis,
    });

    expect(result?.created).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ origin: undefined }),
    );
  });

  it("Caso 4b — sem parentMissionId: nao consulta origin de lugar nenhum, follow-up fica sem origin", async () => {
    const { queue, enqueue } = mockQueue(null);

    const result = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: sourceMission({ parentMissionId: null }),
      delivery: deliveredAnalysis,
    });

    expect(result?.created).toBe(true);
    expect(queue.get).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ origin: undefined }),
    );
  });

  it("Caso 5 — nao cria cadeia follow-up -> follow-up mesmo com origin conhecida na raiz", async () => {
    const { queue, enqueue } = mockQueue({
      objective: buildTechnicalFollowUpObjective("some-other-exec"),
      origin: "HUMAN_DEMAND",
    });

    const result = await enqueueTechnicalFollowUpIfEligible({
      queue,
      logger: noopLogger,
      source: sourceMission(),
      delivery: deliveredAnalysis,
    });

    expect(result).toBeNull();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
