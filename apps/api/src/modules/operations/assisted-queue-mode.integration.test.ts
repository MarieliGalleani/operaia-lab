/**
 * ADR-007 Fase 2.2b — ativacao controlada ASSISTED_QUEUE_MODE / preferQueue.
 * Valida run() via MissionQueue sem alterar contratos HTTP.
 */
import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it, vi } from "vitest";
import { MissionOrchestrator } from "../employees/mission-orchestrator.js";
import { CEO_EMPLOYEE_ID, MissionKind } from "../runtime/mission-states.js";
import { createLabRuntime } from "./lab-runtime.js";
import {
  AssistedQueueMissionFailedError,
  type AssistedMissionQueuePort,
} from "./operational-mission-service.js";
import type { OperationalRun } from "./operational-run.js";
import type { QueueMissionNode } from "./operational-run-from-queue.js";

function ceoStored(input: {
  decision: string;
  analyzed: string;
  summary: string;
  delegations?: Array<{
    specialization: Specialization;
    reason: string;
    task: string;
  }>;
}) {
  return {
    employeeId: CEO_EMPLOYEE_ID,
    output: {
      decision: {
        analyzed: input.analyzed,
        decision: input.decision,
        reasoning: "motivo",
        recommendations: [],
        risks: [],
        nextActions: ["seguir"],
        delegations: input.delegations ?? [],
      },
      report: {
        summary: input.summary,
        analysis: input.analyzed,
        plan: [],
        recommendations: [],
        risks: [],
        nextActions: ["seguir"],
      },
      quality: { passed: true, issues: [] },
    },
  };
}

function specialistStored(employeeId: string, summary: string) {
  return {
    employeeId,
    output: {
      decision: {
        analyzed: "exec",
        decision: "entregar",
        reasoning: "ok",
        recommendations: [],
        risks: [],
        nextActions: [],
        delegations: [],
      },
      report: {
        summary,
        analysis: "",
        plan: [],
        recommendations: [],
        risks: [],
        nextActions: [],
      },
      quality: { passed: true, issues: [] },
    },
  };
}

/** Fila in-memory que simula COORDINATE → EXECUTE → CONSOLIDATE. */
function createLifecycleQueue(options?: {
  failAt?: "never" | "after-enqueue";
  hangForever?: boolean;
}): AssistedMissionQueuePort & {
  enqueues: Array<{ ownerEmployeeId?: string; objective: string }>;
} {
  const enqueues: Array<{ ownerEmployeeId?: string; objective: string }> = [];
  let polls = 0;
  const rootId = "root-lifecycle-1";
  const execId = "exec-lifecycle-1";
  const consolId = "consol-lifecycle-1";

  const initial = ceoStored({
    decision: "delegar",
    analyzed: "precisa engenharia",
    summary: "delegar auth",
    delegations: [
      {
        specialization: Specialization.SOFTWARE_ENGINEERING,
        reason: "tecnico",
        task: "implementar auth",
      },
    ],
  });
  const final = ceoStored({
    decision: "seguir",
    analyzed: "consolidado",
    summary: "Auth priorizada pela Opera",
  });
  const specialist = specialistStored("cto-mag", "Auth entregue pelo Mag");

  const consolidated = {
    phase: "consolidated" as const,
    initial,
    usableResult: "Auth priorizada pela Opera",
    final,
    timing: {
      ceoMs: 5,
      specialistMs: 40,
      consolidationMs: 10,
      totalMs: 55,
    },
  };

  let root: QueueMissionNode = {
    id: rootId,
    status: "QUEUED",
    workspaceId: "nexo",
    objective: "Fechar autenticacao NEXO",
    missionKind: MissionKind.COORDINATE,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    requiredSpecialization: null,
    parentMissionId: null,
    resultJson: null,
    startedAt: "2026-07-28T15:00:00.000Z",
    finishedAt: null,
  };

  const children: QueueMissionNode[] = [];

  function advanceLifecycle() {
    if (options?.hangForever) {
      root = { ...root, status: "RUNNING" };
      return;
    }
    if (options?.failAt === "after-enqueue") {
      root = {
        ...root,
        status: "FAILED",
        finishedAt: "2026-07-28T15:00:10.000Z",
        resultJson: null,
      };
      return;
    }

    polls += 1;
    if (polls === 1) {
      root = { ...root, status: "RUNNING" };
      return;
    }
    if (polls === 2) {
      root = {
        ...root,
        status: "WAITING",
        resultJson: { phase: "coordinated", initial },
      };
      return;
    }

    children.length = 0;
    children.push(
      {
        id: execId,
        status: "COMPLETED",
        workspaceId: "nexo",
        objective: "implementar auth",
        missionKind: MissionKind.EXECUTE,
        ownerEmployeeId: "cto-mag",
        requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
        parentMissionId: rootId,
        resultJson: { phase: "executed", employeeResult: specialist },
        startedAt: "2026-07-28T15:00:20.000Z",
        finishedAt: "2026-07-28T15:00:40.000Z",
      },
      {
        id: consolId,
        status: "COMPLETED",
        workspaceId: "nexo",
        objective: "[CONSOLIDATE] Fechar autenticacao NEXO",
        missionKind: MissionKind.CONSOLIDATE,
        ownerEmployeeId: CEO_EMPLOYEE_ID,
        requiredSpecialization: null,
        parentMissionId: rootId,
        resultJson: consolidated,
        startedAt: "2026-07-28T15:00:45.000Z",
        finishedAt: "2026-07-28T15:00:55.000Z",
      },
    );
    root = {
      ...root,
      status: "COMPLETED",
      resultJson: consolidated,
      finishedAt: "2026-07-28T15:00:55.000Z",
    };
  }

  return {
    enqueues,
    async enqueue(input) {
      enqueues.push({
        ownerEmployeeId: input.ownerEmployeeId,
        objective: input.objective,
      });
      root = {
        ...root,
        objective: input.objective,
        status: "QUEUED",
        ownerEmployeeId: CEO_EMPLOYEE_ID,
      };
      return { mission: { id: rootId }, created: true };
    },
    async get(id) {
      if (id !== rootId) {
        return children.find((c) => c.id === id) ?? null;
      }
      advanceLifecycle();
      return { ...root };
    },
    async listChildren(parentId) {
      if (parentId !== rootId) {
        return [];
      }
      return [...children];
    },
  };
}

function createService(
  queue: AssistedMissionQueuePort,
  preferQueue: boolean,
  wait?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  },
) {
  return createLabRuntime({
    deterministic: true,
    preferQueue,
    missionQueue: queue,
    missionWait: {
      timeoutMs: wait?.timeoutMs ?? 5_000,
      pollIntervalMs: wait?.pollIntervalMs ?? 1,
      sleep: wait?.sleep ?? (async () => undefined),
      ...(wait?.now ? { now: wait.now } : {}),
    },
  }).operations.service;
}

function assertPathACompatibleShape(run: OperationalRun) {
  expect(run).toMatchObject({
    id: expect.any(String),
    status: "completed",
    workspaceId: expect.any(String),
    workspaceName: expect.any(String),
    objective: expect.any(String),
    startedAt: expect.any(String),
    finishedAt: expect.any(String),
    usableResult: expect.any(String),
  });
  expect(run.reply).toMatchObject({
    employeeId: expect.any(String),
    content: expect.any(String),
    answer: {
      summary: expect.any(String),
      projects: expect.any(Array),
      risks: expect.any(Array),
      nextActions: expect.any(Array),
    },
  });
  expect(run.workflow).toMatchObject({
    workspaceId: expect.any(String),
    title: expect.any(String),
    steps: expect.any(Array),
  });
  expect(run.mission.initial.output.decision).toBeDefined();
  expect(run.mission.final.output.decision).toBeDefined();
  expect(Array.isArray(run.mission.outcomes)).toBe(true);
  expect(Array.isArray(run.llmEvents)).toBe(true);
  expect(Array.isArray(run.gaps)).toBe(true);
  expect(run.execution).toMatchObject({
    planId: expect.any(String),
    status: expect.any(String),
    executionId: expect.any(String),
    durationMs: expect.any(Number),
    results: expect.any(Array),
  });
  expect(run.timing).toMatchObject({
    ceoMs: expect.any(Number),
    specialistMs: expect.any(Number),
    consolidationMs: expect.any(Number),
    totalMs: expect.any(Number),
  });

  // Shape HTTP Operations (toResponse) derivado do run
  const httpShape = {
    id: run.id,
    status: run.status,
    usableResult: run.usableResult,
    reply: run.reply,
    workflow: run.workflow,
    decisions: {
      ceoAnalyzed: run.mission.initial.output.decision.analyzed,
      ceoDecision: run.mission.initial.output.decision.decision,
      delegations: run.mission.initial.output.decision.delegations,
    },
    specialists: run.mission.outcomes.map((o) => ({
      matched: o.matched,
      employeeId: o.employeeId,
      specialization: o.request.specialization,
      summary: o.result?.output.report.summary,
    })),
  };
  expect(httpShape.decisions.delegations.length).toBeGreaterThan(0);
  expect(httpShape.specialists[0]?.matched).toBe(true);
}

describe("ADR-007 Fase 2.2b — ASSISTED_QUEUE_MODE / preferQueue", () => {
  it("flag true: cria COORDINATE com owner Opera e nao chama MissionOrchestrator", async () => {
    const queue = createLifecycleQueue();
    const orchestratorSpy = vi.spyOn(MissionOrchestrator.prototype, "run");
    const service = createService(queue, true);

    const run = await service.run({
      workspaceId: "nexo",
      objective: "Fechar autenticacao NEXO",
    });

    expect(queue.enqueues).toHaveLength(1);
    expect(queue.enqueues[0]?.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
    expect(orchestratorSpy).not.toHaveBeenCalled();
    expect(run.id).toBe("root-lifecycle-1");
    orchestratorSpy.mockRestore();
  });

  it("ciclo completo COORDINATE → EXECUTE → CONSOLIDATE → OperationalRun", async () => {
    const queue = createLifecycleQueue();
    const service = createService(queue, true);

    const run = await service.run({
      workspaceId: "nexo",
      objective: "Fechar autenticacao NEXO",
    });

    assertPathACompatibleShape(run);
    expect(run.id).toBe("root-lifecycle-1");
    expect(run.usableResult).toBe("Auth priorizada pela Opera");
    expect(run.reply.answer.summary).toBe("Auth priorizada pela Opera");
    expect(run.mission.initial.output.decision.decision).toBe("delegar");
    expect(run.mission.initial.output.decision.delegations).toHaveLength(1);
    expect(run.mission.outcomes).toHaveLength(1);
    expect(run.mission.outcomes[0]?.employeeId).toBe("cto-mag");
    expect(run.mission.outcomes[0]?.result?.output.report.summary).toBe(
      "Auth entregue pelo Mag",
    );
    expect(run.mission.final.output.decision.decision).toBe("seguir");
    expect(service.get(run.id)?.id).toBe(run.id);
  });

  it("regressao: flag false continua Path A (orchestrator chamado, sem enqueue)", async () => {
    const queue = createLifecycleQueue();
    const orchestratorSpy = vi.spyOn(MissionOrchestrator.prototype, "run");
    const service = createService(queue, false);

    const run = await service.run({
      workspaceId: "nexo",
      objective: "status do projeto",
    });

    expect(queue.enqueues).toHaveLength(0);
    expect(orchestratorSpy).toHaveBeenCalled();
    expect(run.id).not.toBe("root-lifecycle-1");
    expect(run.status).toBe("completed");
    orchestratorSpy.mockRestore();
  });

  it("regressao: flag true usa Queue (enqueue + id da raiz)", async () => {
    const queue = createLifecycleQueue();
    const service = createService(queue, true);
    const run = await service.run({
      workspaceId: "nexo",
      objective: "Fechar autenticacao NEXO",
    });
    expect(queue.enqueues.length).toBe(1);
    expect(run.id).toBe("root-lifecycle-1");
  });

  it("falha de worker retorna erro controlado com missionId", async () => {
    const queue = createLifecycleQueue({ failAt: "after-enqueue" });
    const service = createService(queue, true);

    await expect(
      service.run({
        workspaceId: "nexo",
        objective: "vai falhar",
      }),
    ).rejects.toBeInstanceOf(AssistedQueueMissionFailedError);

    try {
      await service.run({ workspaceId: "nexo", objective: "vai falhar" });
    } catch (error) {
      expect(error).toBeInstanceOf(AssistedQueueMissionFailedError);
      expect((error as AssistedQueueMissionFailedError).missionId).toBe(
        "root-lifecycle-1",
      );
      expect((error as AssistedQueueMissionFailedError).status).toBe("FAILED");
    }
  });

  it("timeout de espera retorna OperationalRun timed_out com missionId da Queue", async () => {
    const queue = createLifecycleQueue({ hangForever: true });
    let now = 0;
    const service = createService(queue, true, {
      timeoutMs: 50,
      pollIntervalMs: 10,
      sleep: async () => {
        now += 25;
      },
      now: () => now,
    });

    const run = await service.run({
      workspaceId: "nexo",
      objective: "hang",
    });

    expect(run.status).toBe("timed_out");
    expect(run.id).toBe("root-lifecycle-1");
    expect(run.finishedAt).toBeNull();
    expect(run.queueStatus).toBe("RUNNING");
    expect(run.gaps.some((g) => g.code === "assisted-wait-timeout")).toBe(true);
    expect(run.usableResult).toContain("root-lifecycle-1");
    expect(service.get(run.id)?.status).toBe("timed_out");
  });
});
