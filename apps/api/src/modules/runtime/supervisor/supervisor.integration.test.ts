/**
 * Integration: Supervisor → Coordination → Opera → Specialist → Memory → OperationalRun
 */
import { Specialization } from "@operaia/employee-framework";
import { describe, expect, it } from "vitest";
import { InMemoryWorkspaceSource } from "../../employees/in-memory-workspace-source.js";
import { buildTestWorkspaceCatalog } from "../../employees/test-workspace-catalog.js";
import { createLabRuntime } from "../../operations/lab-runtime.js";
import { CoordinationDispatcher } from "./coordination-dispatcher.js";
import { InMemoryCoordinationLatchStore } from "./infrastructure/in-memory-coordination-latch-store.js";
import { HealthMonitor } from "./health-monitor.js";
import { InMemorySnapshotStore } from "./infrastructure/in-memory-snapshot-store.js";
import {
  InMemoryOperationalEventStore,
  PersistingSupervisorLogger,
} from "./infrastructure/operational-event-store.js";
import { MissionScanner } from "./mission-scanner.js";
import type { ClockPort, MissionQueuePort, MissionView } from "./ports.js";
import { QueueMonitor } from "./queue-monitor.js";
import { RecoveryCoordinator } from "./recovery-coordinator.js";
import { SnapshotGenerator } from "./snapshot-generator.js";
import { StructuredSupervisorLogger } from "./structured-logger.js";
import { SupervisorLoop } from "./supervisor-loop.js";
import { SupervisorEvent } from "./types.js";
import { WorkspaceScanner } from "./workspace-scanner.js";

const NEXO_AUTH_OBJECTIVE = "Quero adicionar autenticação ao NEXO.";
const fixedNow = new Date("2026-07-28T16:30:00.000Z");
const clock: ClockPort = { now: () => fixedNow };

function emptyQueue(): MissionQueuePort & {
  enqueued: Array<{ objective: string }>;
} {
  const enqueued: Array<{ objective: string }> = [];
  return {
    enqueued,
    async depths() {
      return { queued: 0, running: 0, waiting: 0, failed: 0 };
    },
    async list() {
      return [] as MissionView[];
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
    async enqueue(input) {
      enqueued.push({ objective: input.objective });
      return { created: true, id: "coord-1" };
    },
  };
}

describe("Mission 4 — Supervisor permanente (integration)", () => {
  it("coordenacao do Supervisor leva Opera → Specialist → Memory → OperationalRun", async () => {
    const workspaces = new InMemoryWorkspaceSource(buildTestWorkspaceCatalog());
    const lab = createLabRuntime({ deterministic: true, workspaces });
    const eventStore = new InMemoryOperationalEventStore();
    const logger = new PersistingSupervisorLogger(
      eventStore,
      new StructuredSupervisorLogger(),
    );
    const queue = emptyQueue();
    let operationalRunId: string | null = null;

    const loop = new SupervisorLoop({
      healthMonitor: new HealthMonitor(
        [
          {
            name: "registry",
            check: async () => ({
              status: "ok",
              detail: `${lab.office.registry.all().length}`,
            }),
          },
          {
            name: "memory",
            check: async () => {
              await lab.memory.search({ text: "x", topK: 1 });
              return { status: "ok", detail: "ok" };
            },
          },
          {
            name: "execution-engine",
            check: async () => ({ status: "ok", detail: "ok" }),
          },
          {
            name: "mission-engine",
            check: async () => ({ status: "ok", detail: "ok" }),
          },
        ],
        clock,
      ),
      workspaceScanner: new WorkspaceScanner(workspaces, queue, clock),
      missionScanner: new MissionScanner(queue, clock, 30_000),
      queueMonitor: new QueueMonitor(
        queue,
        {
          list: () =>
            lab.office.registry.all().map((e) => ({
              employeeId: e.profile.id,
              status: "idle",
            })),
          aliveCount: () => lab.office.registry.all().length,
        },
        clock,
        30_000,
      ),
      recoveryCoordinator: new RecoveryCoordinator(
        queue,
        logger,
        clock,
        30_000,
      ),
      coordinationDispatcher: new CoordinationDispatcher(queue, logger, new InMemoryCoordinationLatchStore()),
      snapshots: new SnapshotGenerator(clock),
      snapshotStore: new InMemorySnapshotStore(),
      logger,
      intervalMs: 60_000,
      staleRunningMs: 30_000,
    });

    const ctx = await loop.runCycle();
    expect(ctx).not.toBeNull();
    expect(ctx!.dispatch.dispatched).toBeGreaterThan(0);
    expect(queue.enqueued.length).toBeGreaterThan(0);
    expect(queue.enqueued[0]?.objective).toContain("[COORDINATE/");

    // Simula worker consumindo COORDINATE e acionando Mission Orchestrator / Opera.
    const run = await lab.operations.service.run({
      workspaceId: "nexo",
      objective: NEXO_AUTH_OBJECTIVE,
      employeeId: "operaia-ceo",
    });
    operationalRunId = run.id;
    expect(operationalRunId).toBeTruthy();

    const stored = lab.operations.store.get(operationalRunId!);
    expect(stored?.mission.initial.employeeId).toBe("operaia-ceo");
    expect(
      stored?.mission.initial.output.decision.delegations[0]?.specialization,
    ).toBe(Specialization.SOFTWARE_ENGINEERING);
    expect(
      stored?.mission.outcomes.some(
        (o) => o.matched && o.employeeId === "cto-mag",
      ),
    ).toBe(true);
    expect(stored?.mission.final.employeeId).toBe("operaia-ceo");

    const memoryHits = await lab.memory.search({
      text: NEXO_AUTH_OBJECTIVE,
      topK: 5,
      filter: { workspaceId: "nexo" },
    });
    expect(memoryHits.length).toBeGreaterThan(0);

    const events = await eventStore.list(30);
    expect(events.some((e) => e.event === SupervisorEvent.HEALTH_CHECK)).toBe(
      true,
    );
    expect(
      events.some((e) => e.event === SupervisorEvent.COORDINATION_CREATED),
    ).toBe(true);
  });

  it("loop start/stop graceful", async () => {
    const workspaces = new InMemoryWorkspaceSource(buildTestWorkspaceCatalog());
    const queue = emptyQueue();
    const eventStore = new InMemoryOperationalEventStore();
    const logger = new PersistingSupervisorLogger(eventStore);

    const loop = new SupervisorLoop({
      healthMonitor: new HealthMonitor(
        [
          {
            name: "noop",
            check: async () => ({ status: "ok", detail: "ok" }),
          },
        ],
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
      recoveryCoordinator: new RecoveryCoordinator(
        queue,
        logger,
        clock,
        30_000,
      ),
      coordinationDispatcher: new CoordinationDispatcher(queue, logger, new InMemoryCoordinationLatchStore()),
      snapshots: new SnapshotGenerator(clock),
      snapshotStore: new InMemorySnapshotStore(),
      logger,
      intervalMs: 60_000,
      staleRunningMs: 30_000,
    });

    loop.start();
    expect(loop.isRunning).toBe(true);
    await loop.stop();
    expect(loop.isRunning).toBe(false);
    const events = await eventStore.list(20);
    expect(events.some((e) => e.event === SupervisorEvent.SUPERVISOR_STARTED)).toBe(
      true,
    );
    expect(events.some((e) => e.event === SupervisorEvent.SUPERVISOR_STOPPED)).toBe(
      true,
    );
  });
});
