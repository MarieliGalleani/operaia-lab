import { describe, expect, it } from "vitest";
import { NoopEventPublisher } from "../defaults/noop-event-publisher.js";
import { InMemoryStateStore } from "../defaults/in-memory-state-store.js";
import type {
  OrchestrationEvent,
} from "../events/orchestration-events.js";
import { OrchestrationEventType } from "../events/orchestration-events.js";
import type { Clock } from "../ports/clock.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type {
  ExecutionEnginePort,
  ExecutionSummary,
} from "../ports/execution-engine.js";
import type {
  ProposedPlan,
  RuntimeOutcome,
  RuntimePort,
  RuntimeRequest,
} from "../ports/runtime.js";
import type { LoopPolicy } from "../policies/loop-policy.js";
import { defaultLoopPolicy } from "../policies/loop-policy.js";
import { ExponentialBackoffRetryPolicy } from "../policies/retry-policy.js";
import { StopReason, type StopPolicy } from "../policies/stop-policy.js";
import {
  OrchestrationEngine,
  type OrchestrationEngineDependencies,
} from "./orchestration-engine.js";
import { OrchestrationStatus } from "./orchestration-state.js";

class IncrementingClock implements Clock {
  private ms = 0;
  now(): Date {
    this.ms += 1;
    return new Date(this.ms);
  }
}

const SUCCESS_SUMMARY: ExecutionSummary = {
  status: "SUCCESS",
  executed: 1,
  failed: 0,
  durationMs: 1,
};

function makePlan(id = "plan"): ProposedPlan {
  return { id, actionCount: 1, payload: {} };
}

function outcome(objectiveCompleted: boolean): RuntimeOutcome {
  return { plan: makePlan(), objectiveCompleted };
}

class ScriptedRuntime implements RuntimePort {
  calls = 0;
  readonly requests: RuntimeRequest[] = [];
  constructor(
    private readonly script: (call: number, req: RuntimeRequest) => RuntimeOutcome,
  ) {}
  async run(req: RuntimeRequest): Promise<RuntimeOutcome> {
    this.calls += 1;
    this.requests.push(req);
    return this.script(this.calls, req);
  }
}

class ExecutionStub implements ExecutionEnginePort {
  calls = 0;
  constructor(private readonly onExecute?: () => void) {}
  async execute(): Promise<ExecutionSummary> {
    this.calls += 1;
    this.onExecute?.();
    return SUCCESS_SUMMARY;
  }
}

class RecordingPublisher implements EventPublisher {
  readonly events: OrchestrationEvent[] = [];
  publish(event: OrchestrationEvent): void {
    this.events.push(event);
  }
}

function buildEngine(
  overrides: Partial<OrchestrationEngineDependencies> &
    Pick<OrchestrationEngineDependencies, "runtime">,
): OrchestrationEngine {
  return new OrchestrationEngine({
    executionEngine: new ExecutionStub(),
    stateStore: new InMemoryStateStore(),
    eventPublisher: new NoopEventPublisher(),
    clock: new IncrementingClock(),
    ...overrides,
  });
}

function policy(overrides: Partial<LoopPolicy>): LoopPolicy {
  return { ...defaultLoopPolicy, ...overrides };
}

describe("OrchestrationEngine", () => {
  it("executa um loop simples e conclui o objetivo em um ciclo", async () => {
    const engine = buildEngine({
      runtime: new ScriptedRuntime(() => outcome(true)),
    });

    const result = await engine.run({ objective: "Planejar NEXO" });

    expect(result.status).toBe(OrchestrationStatus.COMPLETED);
    expect(result.cycles).toBe(1);
    expect(result.objectiveCompleted).toBe(true);
    expect(result.history).toHaveLength(1);
    expect(result.executionSummary).toEqual(SUCCESS_SUMMARY);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("executa multiplos ciclos ate concluir e replaneja com o resultado anterior", async () => {
    const runtime = new ScriptedRuntime((call) => outcome(call === 3));
    const engine = buildEngine({ runtime });

    const result = await engine.run({ objective: "Objetivo longo" });

    expect(result.cycles).toBe(3);
    expect(result.status).toBe(OrchestrationStatus.COMPLETED);
    // No 2o ciclo, o runtime recebe o resultado da execucao anterior (replan).
    expect(runtime.requests[1]?.previousExecution).toEqual(SUCCESS_SUMMARY);
  });

  it("para em FAILED ao atingir o maximo de falhas", async () => {
    const runtime = new ScriptedRuntime(() => {
      throw new Error("runtime indisponivel");
    });
    const engine = buildEngine({ runtime, loopPolicy: policy({ maxFailures: 1 }) });

    const result = await engine.run({ objective: "Vai falhar" });

    expect(result.status).toBe(OrchestrationStatus.FAILED);
    expect(result.cycles).toBe(1);
    expect(result.history[0]?.error).toContain("runtime indisponivel");
  });

  it("aplica retry e conclui apos uma falha transitoria", async () => {
    const runtime = new ScriptedRuntime((call) => {
      if (call === 1) {
        throw new Error("transitorio");
      }
      return outcome(true);
    });
    const engine = buildEngine({
      runtime,
      retryPolicy: new ExponentialBackoffRetryPolicy({
        maxRetries: 2,
        baseDelayMs: 0,
        factor: 1,
      }),
    });

    const result = await engine.run({ objective: "Com retry" });

    expect(result.status).toBe(OrchestrationStatus.COMPLETED);
    expect(result.cycles).toBe(1);
    expect(runtime.calls).toBe(2);
  });

  it("para em FAILED ao atingir o maximo de ciclos sem concluir", async () => {
    const runtime = new ScriptedRuntime(() => outcome(false));
    const engine = buildEngine({
      runtime,
      loopPolicy: policy({ maxCycles: 2, maxFailures: null }),
    });

    const result = await engine.run({ objective: "Nunca conclui" });

    expect(result.status).toBe(OrchestrationStatus.FAILED);
    expect(result.cycles).toBe(2);
    expect(result.objectiveCompleted).toBe(false);
  });

  it("respeita uma stop policy plugavel", async () => {
    const runtime = new ScriptedRuntime(() => outcome(false));
    const stopPolicy: StopPolicy = {
      evaluate: () => ({ stop: true, reason: StopReason.OBJECTIVE_COMPLETED }),
    };
    const engine = buildEngine({ runtime, stopPolicy });

    const result = await engine.run({ objective: "Stop custom" });

    expect(result.cycles).toBe(1);
    expect(result.status).toBe(OrchestrationStatus.COMPLETED);
  });

  it("cancela imediatamente quando o signal ja esta abortado", async () => {
    const controller = new AbortController();
    controller.abort();
    const engine = buildEngine({
      runtime: new ScriptedRuntime(() => outcome(false)),
    });

    const result = await engine.run({
      objective: "Cancelado",
      signal: controller.signal,
    });

    expect(result.status).toBe(OrchestrationStatus.CANCELLED);
    expect(result.cycles).toBe(0);
    expect(result.history).toHaveLength(0);
  });

  it("cancela no meio do loop apos um ciclo", async () => {
    const controller = new AbortController();
    const engine = buildEngine({
      runtime: new ScriptedRuntime(() => outcome(false)),
      executionEngine: new ExecutionStub(() => controller.abort()),
    });

    const result = await engine.run({
      objective: "Cancelar no meio",
      signal: controller.signal,
    });

    expect(result.status).toBe(OrchestrationStatus.CANCELLED);
    expect(result.cycles).toBe(1);
  });

  it("emite a sequencia esperada de eventos", async () => {
    const publisher = new RecordingPublisher();
    const engine = buildEngine({
      runtime: new ScriptedRuntime(() => outcome(true)),
      eventPublisher: publisher,
    });

    await engine.run({ objective: "Eventos" });

    const types = publisher.events.map((e) => e.type);
    expect(types).toEqual([
      OrchestrationEventType.LOOP_STARTED,
      OrchestrationEventType.CYCLE_STARTED,
      OrchestrationEventType.EXECUTION_COMPLETED,
      OrchestrationEventType.OBJECTIVE_COMPLETED,
      OrchestrationEventType.LOOP_FINISHED,
    ]);
  });

  it("persiste o estado final no StateStore", async () => {
    const store = new InMemoryStateStore();
    const engine = buildEngine({
      runtime: new ScriptedRuntime(() => outcome(true)),
      stateStore: store,
    });

    const result = await engine.run({ objective: "Persistir" });
    const persisted = await store.load(result.id);

    expect(persisted?.status).toBe(OrchestrationStatus.COMPLETED);
    expect(persisted?.history).toHaveLength(1);
  });
});
