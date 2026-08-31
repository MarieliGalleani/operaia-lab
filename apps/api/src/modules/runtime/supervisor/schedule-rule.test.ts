/**
 * F6.2 — ScheduleRule tick recorrente (unitario, sem Prisma).
 */
import { describe, expect, it, vi } from "vitest";
import { MissionScheduler, type MissionSchedulerOptions } from "../mission-scheduler.js";
import type { MissionQueue } from "../mission-queue.js";
import { CEO_EMPLOYEE_ID } from "../mission-states.js";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import { HealthMonitor } from "./health-monitor.js";
import { InMemoryCoordinationLatchStore } from "./infrastructure/in-memory-coordination-latch-store.js";
import { InMemorySnapshotStore } from "./infrastructure/in-memory-snapshot-store.js";
import { MissionScanner } from "./mission-scanner.js";
import type {
  ScheduleRulePort,
  ScheduleRuleRecord,
  SupervisorLoggerPort,
} from "./ports.js";
import { QueueMonitor } from "./queue-monitor.js";
import { RecoveryCoordinator } from "./recovery-coordinator.js";
import { SnapshotGenerator } from "./snapshot-generator.js";
import { SupervisorLoop } from "./supervisor-loop.js";
import { SupervisorEvent } from "./types.js";
import { WorkspaceScanner } from "./workspace-scanner.js";
import { InMemoryWorkspaceSource } from "../../employees/in-memory-workspace-source.js";
import { buildTestWorkspaceCatalog } from "../../employees/test-workspace-catalog.js";

const fixedNow = new Date("2026-08-19T14:00:00.000Z");
const clock = { now: () => fixedNow };

function noopLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

function createScheduleRulesMock(
  rules: readonly ScheduleRuleRecord[],
): ScheduleRulePort & { marked: Array<{ id: string; at: Date }> } {
  const marked: Array<{ id: string; at: Date }> = [];
  return {
    marked,
    async listEnabled() {
      return rules;
    },
    async markEnqueued(id, at) {
      marked.push({ id, at });
    },
  };
}

function createQueueMock() {
  const enqueued: Array<{
    workspaceId: string;
    objective: string;
    ownerEmployeeId: string;
    dedupe?: boolean;
    origin?: string;
  }> = [];
  let shouldCreate = true;
  return {
    enqueued,
    setShouldCreate(value: boolean) {
      shouldCreate = value;
    },
    queue: {
      async enqueue(input: {
        workspaceId: string;
        objective: string;
        ownerEmployeeId: string;
        dedupe?: boolean;
        origin?: string;
      }) {
        enqueued.push(input);
        return { created: shouldCreate, id: shouldCreate ? `m-${enqueued.length}` : "dup" };
      },
    } as unknown as MissionQueue,
  };
}

function createScheduler(input: {
  scheduleRules: ScheduleRulePort;
  queue: MissionQueue;
}) {
  return new MissionScheduler({
    queue: input.queue,
    workspaces: { listWorkspaces: async () => [] },
    projects: {} as MissionSchedulerOptions["projects"],
    tasks: {} as MissionSchedulerOptions["tasks"],
    intervalMs: 60_000,
    logger: noopLogger(),
    improvement: {
      analyze: async () => [],
      getObservers: () => [],
    } as unknown as MissionSchedulerOptions["improvement"],
    governance: {
      countPending: async () => 0,
    } as MissionSchedulerOptions["governance"],
    learningStats: { count: async () => 0 },
    scheduleRules: input.scheduleRules,
  } as unknown as MissionSchedulerOptions);
}

describe("MissionScheduler.runScheduleRulesCycle", () => {
  it("A — regra due cria COORDINATE", async () => {
    const scheduleRules = createScheduleRulesMock([
      {
        id: "rule-1",
        workspaceId: "nexo",
        intervalSec: 300,
        lastEnqueuedAt: null,
        objective: "F6.2 due objective",
      },
    ]);
    const { queue, enqueued } = createQueueMock();
    const scheduler = createScheduler({ scheduleRules, queue });

    const result = await scheduler.runScheduleRulesCycle(fixedNow);

    expect(result).toEqual({ inspected: 1, due: 1, enqueued: 1, deduped: 0 });
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      workspaceId: "nexo",
      objective: "F6.2 due objective",
      ownerEmployeeId: CEO_EMPLOYEE_ID,
      dedupe: true,
      origin: "SCHEDULE_RULE",
    });
  });

  it("B — regra nao due nao cria", async () => {
    const scheduleRules = createScheduleRulesMock([
      {
        id: "rule-1",
        workspaceId: "nexo",
        intervalSec: 300,
        lastEnqueuedAt: new Date(fixedNow.getTime() - 60_000),
        objective: "F6.2 not due",
      },
    ]);
    const { queue, enqueued } = createQueueMock();
    const scheduler = createScheduler({ scheduleRules, queue });

    const result = await scheduler.runScheduleRulesCycle(fixedNow);

    expect(result).toEqual({ inspected: 1, due: 0, enqueued: 0, deduped: 0 });
    expect(enqueued).toHaveLength(0);
    expect(scheduleRules.marked).toHaveLength(0);
  });

  it("C — regra disabled nao e listada", async () => {
    const scheduleRules = createScheduleRulesMock([]);
    const { queue, enqueued } = createQueueMock();
    const scheduler = createScheduler({ scheduleRules, queue });

    const result = await scheduler.runScheduleRulesCycle(fixedNow);

    expect(result.inspected).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  it("D — workspaceId ausente nao cria", async () => {
    const scheduleRules = createScheduleRulesMock([
      {
        id: "rule-1",
        workspaceId: null,
        intervalSec: 60,
        lastEnqueuedAt: null,
      },
    ]);
    const { queue, enqueued } = createQueueMock();
    const scheduler = createScheduler({ scheduleRules, queue });

    const result = await scheduler.runScheduleRulesCycle(fixedNow);

    expect(result).toEqual({ inspected: 1, due: 0, enqueued: 0, deduped: 0 });
    expect(enqueued).toHaveLength(0);
  });

  it("E — dedupe nao cria duplicata", async () => {
    const scheduleRules = createScheduleRulesMock([
      {
        id: "rule-1",
        workspaceId: "nexo",
        intervalSec: 60,
        lastEnqueuedAt: null,
        objective: "F6.2 dedupe",
      },
    ]);
    const { queue, enqueued, setShouldCreate } = createQueueMock();
    const scheduler = createScheduler({ scheduleRules, queue });

    await scheduler.runScheduleRulesCycle(fixedNow);
    setShouldCreate(false);
    const second = await scheduler.runScheduleRulesCycle(
      new Date(fixedNow.getTime() + 120_000),
    );

    expect(second).toEqual({ inspected: 1, due: 1, enqueued: 0, deduped: 1 });
    expect(enqueued).toHaveLength(2);
  });

  it("F — markEnqueued e chamado mesmo com dedupe", async () => {
    const scheduleRules = createScheduleRulesMock([
      {
        id: "rule-1",
        workspaceId: "nexo",
        intervalSec: 60,
        lastEnqueuedAt: null,
      },
    ]);
    const { queue, setShouldCreate } = createQueueMock();
    setShouldCreate(false);
    const scheduler = createScheduler({ scheduleRules, queue });

    await scheduler.runScheduleRulesCycle(fixedNow);

    expect(scheduleRules.marked).toEqual([{ id: "rule-1", at: fixedNow }]);
  });

  it("G — tick nao cria missao de portfolio", async () => {
    const scheduleRules = createScheduleRulesMock([
      {
        id: "rule-1",
        workspaceId: "nexo",
        intervalSec: 60,
        lastEnqueuedAt: null,
        objective: "F6.2 schedule only",
      },
    ]);
    const { queue, enqueued } = createQueueMock();
    const scheduler = createScheduler({ scheduleRules, queue });

    await scheduler.runScheduleRulesCycle(fixedNow);

    expect(enqueued.every((item) => !item.objective.includes("Priorizar Workspace"))).toBe(
      true,
    );
    expect(enqueued.every((item) => !item.objective.includes("Acompanhar projeto"))).toBe(
      true,
    );
  });

  it("H — erro isolado nao derruba as demais", async () => {
    const scheduleRules: ScheduleRulePort & {
      marked: Array<{ id: string; at: Date }>;
    } = {
      marked: [],
      async listEnabled() {
        return [
          {
            id: "bad",
            workspaceId: "nexo",
            intervalSec: 60,
            lastEnqueuedAt: null,
          },
          {
            id: "good",
            workspaceId: "nexo",
            intervalSec: 60,
            lastEnqueuedAt: null,
            objective: "F6.2 good rule",
          },
        ];
      },
      async markEnqueued(id, at) {
        this.marked.push({ id, at });
      },
    };

    const enqueued: string[] = [];
    let enqueueCalls = 0;
    const queue = {
      async enqueue(input: { workspaceId: string; objective: string }) {
        enqueueCalls += 1;
        if (enqueueCalls === 1) {
          throw new Error("enqueue failed");
        }
        enqueued.push(input.objective);
        return { created: true, id: `m-${enqueued.length}` };
      },
    } as unknown as MissionQueue;

    const scheduler = createScheduler({ scheduleRules, queue });
    const result = await scheduler.runScheduleRulesCycle(fixedNow);

    expect(result.enqueued).toBe(1);
    expect(enqueued).toEqual(["F6.2 good rule"]);
    expect(scheduleRules.marked.some((m) => m.id === "good")).toBe(true);
  });
});

describe("SupervisorLoop — ScheduleRule tick", () => {
  it("I — executa ScheduleRule tick no ciclo", async () => {
    const events: string[] = [];
    const logger: SupervisorLoggerPort = {
      emit(event) {
        events.push(event);
      },
    };
    const tick = vi.fn(async () => ({
      inspected: 2,
      due: 1,
      enqueued: 1,
      deduped: 0,
    }));

    const queue = {
      async depths() {
        return { queued: 0, running: 0, waiting: 0, failed: 0 };
      },
      async list() {
        return [];
      },
      async recoverStaleRunning() {
        return 0;
      },
      async recoverWaitingParents() {
        return 0;
      },
      async recoverBlockedDag() {
        return 0;
      },
      async recoverFailedRetryable() {
        return 0;
      },
      async enqueue() {
        return { created: false };
      },
    };

    const workspaces = new InMemoryWorkspaceSource(buildTestWorkspaceCatalog());
    const loop = new SupervisorLoop({
      healthMonitor: new HealthMonitor(
        [{ name: "registry", check: async () => ({ status: "ok", detail: "ok" }) }],
        clock,
      ),
      workspaceScanner: new WorkspaceScanner(workspaces, queue, clock),
      missionScanner: new MissionScanner(queue, clock, 30_000),
      queueMonitor: new QueueMonitor(
        queue,
        { list: () => [], aliveCount: () => 0 },
        clock,
        30_000,
      ),
      recoveryCoordinator: new RecoveryCoordinator(queue, logger, clock, 30_000),
      scheduleRuleTick: { runScheduleRulesCycle: tick },
      coordinationDispatcher: new CoordinationDispatcher(
        queue,
        logger,
        new InMemoryCoordinationLatchStore(),
      ),
      snapshots: new SnapshotGenerator(clock),
      snapshotStore: new InMemorySnapshotStore(),
      logger,
      intervalMs: 60_000,
      staleRunningMs: 30_000,
    });

    await loop.runCycle();

    expect(tick).toHaveBeenCalledTimes(1);
    expect(events).toContain(SupervisorEvent.SCHEDULE_RULES_TICK);
  });
});
