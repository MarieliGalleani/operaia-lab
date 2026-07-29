import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it, vi } from "vitest";
import { CEO_EMPLOYEE_ID, MissionKind } from "../runtime/mission-states.js";
import { createLabRuntime } from "./lab-runtime.js";
import type { AssistedMissionQueuePort } from "./operational-mission-service.js";
import type { QueueMissionNode } from "./operational-run-from-queue.js";
import {
  DEFAULT_ASSISTED_EXECUTION_CONFIG,
  resolveAssistedExecutionConfig,
} from "./assisted-execution-config.js";

function storedCeo(summary = "ok via fila") {
  return {
    employeeId: CEO_EMPLOYEE_ID,
    output: {
      decision: {
        analyzed: "a",
        decision: "responder",
        reasoning: "r",
        recommendations: [],
        risks: [],
        nextActions: ["seguir"],
        delegations: [],
      },
      report: {
        summary,
        analysis: "a",
        plan: [],
        recommendations: [],
        risks: [],
        nextActions: ["seguir"],
      },
      quality: { passed: true, issues: [] },
    },
  };
}

function consolidatedWithInitial(summary = "ok via fila") {
  const ceo = storedCeo(summary);
  return {
    phase: "consolidated" as const,
    initial: ceo,
    usableResult: summary,
    final: ceo,
    timing: {
      ceoMs: 0,
      specialistMs: 0,
      consolidationMs: 0,
      totalMs: 10,
    },
  };
}

function createService(
  queue?: AssistedMissionQueuePort,
  preferQueue = false,
) {
  const lab = createLabRuntime({
    deterministic: true,
    preferQueue,
    ...(queue
      ? {
          missionQueue: queue,
          missionWait: {
            timeoutMs: 5_000,
            pollIntervalMs: 1,
            sleep: async () => undefined,
          },
        }
      : {}),
  });
  return lab.operations.service;
}

function fakeQueue(options?: {
  statusSequence?: string[];
  resultJson?: unknown;
  children?: readonly QueueMissionNode[];
}): AssistedMissionQueuePort & { enqueueCalls: number } {
  const statuses = options?.statusSequence ?? ["QUEUED", "COMPLETED"];
  let poll = 0;
  const resultJson = options?.resultJson ?? consolidatedWithInitial();
  const snapshot: QueueMissionNode = {
    id: "queued-1",
    status: statuses[0]!,
    workspaceId: "nexo",
    objective: "objetivo fila",
    missionKind: MissionKind.COORDINATE,
    ownerEmployeeId: CEO_EMPLOYEE_ID,
    requiredSpecialization: null,
    parentMissionId: null,
    resultJson,
    startedAt: "2026-07-28T12:00:00.000Z",
    finishedAt: "2026-07-28T12:01:00.000Z",
  };

  const port: AssistedMissionQueuePort & { enqueueCalls: number } = {
    enqueueCalls: 0,
    async enqueue(input) {
      port.enqueueCalls += 1;
      expect(input.ownerEmployeeId).toBe(CEO_EMPLOYEE_ID);
      return { mission: { id: snapshot.id }, created: true };
    },
    async get() {
      const status = statuses[Math.min(poll, statuses.length - 1)]!;
      poll += 1;
      return { ...snapshot, status };
    },
    async listChildren() {
      return options?.children ?? [];
    },
  };
  return port;
}

describe("assisted-execution-config (Fase 2.2a)", () => {
  it("default do modulo isolado permanece preferQueue=false (kill-switch de testes)", () => {
    expect(DEFAULT_ASSISTED_EXECUTION_CONFIG.preferQueue).toBe(false);
    expect(resolveAssistedExecutionConfig().preferQueue).toBe(false);
    expect(resolveAssistedExecutionConfig({ preferQueue: true }).preferQueue).toBe(
      true,
    );
  });
});

describe("OperationalMissionService feature flag MissionQueue (Fase 2.2a)", () => {
  it("Caso 1: preferQueue=false usa Path A e nao enfileira", async () => {
    const queue = fakeQueue();
    const service = createService(queue, false);

    const run = await service.run({
      workspaceId: "nexo",
      objective: "status do projeto",
    });

    expect(service.prefersQueue).toBe(false);
    expect(queue.enqueueCalls).toBe(0);
    expect(run.status).toBe("completed");
    expect(run.id).not.toBe("queued-1");
    expect(service.get(run.id)?.id).toBe(run.id);
  });

  it("Caso 2: preferQueue=true enfileira COORDINATE Opera e retorna OperationalRun", async () => {
    const queue = fakeQueue();
    const service = createService(queue, true);

    const run = await service.run({
      workspaceId: "nexo",
      objective: "objetivo fila",
    });

    expect(service.prefersQueue).toBe(true);
    expect(queue.enqueueCalls).toBe(1);
    expect(run.id).toBe("queued-1");
    expect(run.status).toBe("completed");
    expect(run.usableResult).toBe("ok via fila");
    expect(run.reply.answer.summary).toBe("ok via fila");
    expect(run.mission.initial.employeeId).toBe(CEO_EMPLOYEE_ID);
    expect(run.workflow.steps.length).toBeGreaterThan(0);
    expect(service.get(run.id)?.id).toBe(run.id);
  });

  it("Caso 2b: preferQueue=true com EXECUTE child projeta outcomes", async () => {
    const initial = {
      employeeId: CEO_EMPLOYEE_ID,
      output: {
        decision: {
          analyzed: "precisa auth",
          decision: "delegar",
          reasoning: "engenharia",
          recommendations: [],
          risks: [],
          nextActions: [],
          delegations: [
            {
              specialization: Specialization.SOFTWARE_ENGINEERING,
              reason: "tecnico",
              task: "auth",
            },
          ],
        },
        report: {
          summary: "delegar",
          analysis: "",
          plan: [],
          recommendations: [],
          risks: [],
          nextActions: [],
        },
        quality: { passed: true, issues: [] },
      },
    };
    const final = storedCeo("Auth priorizada");
    const specialist = {
      employeeId: "cto-mag",
      output: {
        decision: {
          analyzed: "x",
          decision: "ok",
          reasoning: "r",
          recommendations: [],
          risks: [],
          nextActions: [],
          delegations: [],
        },
        report: {
          summary: "Auth entregue",
          analysis: "",
          plan: [],
          recommendations: [],
          risks: [],
          nextActions: [],
        },
        quality: { passed: true, issues: [] },
      },
    };

    const queue = fakeQueue({
      resultJson: {
        phase: "consolidated",
        initial,
        usableResult: "Auth priorizada",
        final,
      },
      children: [
        {
          id: "exec-1",
          status: "COMPLETED",
          workspaceId: "nexo",
          objective: "auth",
          missionKind: MissionKind.EXECUTE,
          ownerEmployeeId: "cto-mag",
          requiredSpecialization: Specialization.SOFTWARE_ENGINEERING,
          parentMissionId: "queued-1",
          resultJson: { phase: "executed", employeeResult: specialist },
          startedAt: "2026-07-28T12:00:30.000Z",
          finishedAt: "2026-07-28T12:00:50.000Z",
        },
      ],
    });

    const run = await createService(queue, true).run({
      workspaceId: "nexo",
      objective: "auth",
    });

    expect(run.mission.outcomes).toHaveLength(1);
    expect(run.mission.outcomes[0]?.matched).toBe(true);
    expect(run.mission.outcomes[0]?.employeeId).toBe("cto-mag");
  });

  it("runViaQueue forca Opera quando employeeId e specialist", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const queue = fakeQueue();
    const service = createService(queue, false);

    const run = await service.runViaQueue({
      workspaceId: "nexo",
      objective: "x",
      employeeId: "mag-cto",
    });

    expect(run.id).toBe("queued-1");
    expect(run.gaps.some((g) => g.code === "assisted-owner-forced-opera")).toBe(
      true,
    );
    expect(log).toHaveBeenCalledWith(
      "[assisted-facade] employeeId forced to Opera",
      expect.objectContaining({
        requested: "mag-cto",
        ownerEmployeeId: CEO_EMPLOYEE_ID,
      }),
    );
    log.mockRestore();
  });

  it("preferQueue=true sem queue falha de forma explicita", async () => {
    const service = createService(undefined, true);
    await expect(
      service.run({ workspaceId: "nexo", objective: "x" }),
    ).rejects.toThrow(/MissionQueue nao configurada/);
  });

  it("bindQueue habilita hasQueue sem preferQueue", () => {
    const service = createService();
    expect(service.hasQueue).toBe(false);
    expect(service.assistedConfig.preferQueue).toBe(false);
    service.bindQueue(fakeQueue());
    expect(service.hasQueue).toBe(true);
    expect(service.prefersQueue).toBe(false);
  });
});
