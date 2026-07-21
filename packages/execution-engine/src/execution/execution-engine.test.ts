import { Priority } from "@operaia/shared";
import { describe, expect, it, vi } from "vitest";
import { NoopExecutor } from "../defaults/noop-executor.js";
import { TaskActionExecutor } from "../defaults/task-action-executor.js";
import { BaseActionExecutor } from "../executors/action-executor.js";
import { ExecutorRegistry } from "../executors/registry.js";
import { InvalidExecutionPlanError } from "../errors/execution-errors.js";
import type { Clock } from "../ports/clock.js";
import type { ExecutionStore } from "../ports/execution-store.js";
import {
  ActionStatus,
  ActionType,
  type Action,
  type ActionOutput,
} from "./action.js";
import { ExecutionEngine } from "./execution-engine.js";
import { ExecutionPhase } from "./execution-log.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { ExecutionStatus } from "./execution-result.js";

class IncrementingClock implements Clock {
  private ms = 0;
  now(): Date {
    this.ms += 1;
    return new Date(this.ms);
  }
}

/** Executor de teste parametrizavel por tipo, com registro de ordem. */
class RecordingExecutor extends BaseActionExecutor {
  readonly name: string;
  protected readonly type: string;
  constructor(
    type: string,
    private readonly order?: string[],
  ) {
    super();
    this.type = type;
    this.name = `exec:${type}`;
  }
  execute(action: Action): ActionOutput {
    this.order?.push(action.id);
    return { handled: action.type };
  }
}

class FailingExecutor extends BaseActionExecutor {
  readonly name = "exec:failing";
  protected readonly type = ActionType.UPDATE_TASK;
  execute(): ActionOutput {
    throw new Error("falha simulada");
  }
}

function action(overrides: Partial<Action> & Pick<Action, "id" | "type">): Action {
  return {
    description: `acao ${overrides.id}`,
    payload: {},
    priority: Priority.MEDIUM,
    status: ActionStatus.PENDING,
    ...overrides,
  };
}

function plan(actions: readonly Action[], id = "plan-1"): ExecutionPlan {
  return { id, actions };
}

function buildEngine(
  register: (registry: ExecutorRegistry) => void,
  extra?: { store?: ExecutionStore; stopOnError?: boolean },
): ExecutionEngine {
  const registry = new ExecutorRegistry();
  register(registry);
  return new ExecutionEngine({
    registry,
    clock: new IncrementingClock(),
    ...(extra?.store ? { store: extra.store } : {}),
    ...(extra?.stopOnError !== undefined ? { stopOnError: extra.stopOnError } : {}),
  });
}

describe("ExecutionEngine", () => {
  it("executa o plano completo e retorna ExecutionResult", async () => {
    const engine = buildEngine((r) =>
      r.register(new TaskActionExecutor()).register(new NoopExecutor()),
    );

    const result = await engine.execute(
      plan([
        action({ id: "a1", type: ActionType.CREATE_TASK }),
        action({ id: "a2", type: ActionType.LOG }),
      ]),
    );

    expect(result.status).toBe(ExecutionStatus.SUCCESS);
    expect(result.executed).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.executionId).toBeTruthy();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.executed[0]?.executor).toBe("task.create");
    expect(result.executed[0]?.output).toEqual({
      acknowledged: true,
      type: ActionType.CREATE_TASK,
      payload: {},
    });
  });

  it("marca a acao como falha quando nao ha executor (executor nao encontrado)", async () => {
    const engine = buildEngine((r) => r.register(new NoopExecutor()));

    const result = await engine.execute(
      plan([action({ id: "a1", type: ActionType.UPDATE_PROJECT })]),
    );

    expect(result.status).toBe(ExecutionStatus.FAILED);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.executor).toBeNull();
    expect(result.failed[0]?.error).toContain("Nenhum executor encontrado");
  });

  it("captura erro lancado por um executor", async () => {
    const engine = buildEngine((r) => r.register(new FailingExecutor()));

    const result = await engine.execute(
      plan([action({ id: "a1", type: ActionType.UPDATE_TASK })]),
    );

    expect(result.status).toBe(ExecutionStatus.FAILED);
    expect(result.failed[0]?.status).toBe(ActionStatus.FAILED);
    expect(result.failed[0]?.executor).toBe("exec:failing");
    expect(result.failed[0]?.error).toBe("falha simulada");
  });

  it("executa multiplas acoes preservando a ordem do plano", async () => {
    const order: string[] = [];
    const engine = buildEngine((r) =>
      r
        .register(new RecordingExecutor(ActionType.CREATE_TASK, order))
        .register(new RecordingExecutor(ActionType.CREATE_NOTE, order))
        .register(new RecordingExecutor(ActionType.LOG, order)),
    );

    const result = await engine.execute(
      plan([
        action({ id: "a1", type: ActionType.CREATE_TASK }),
        action({ id: "a2", type: ActionType.CREATE_NOTE }),
        action({ id: "a3", type: ActionType.LOG }),
      ]),
    );

    expect(order).toEqual(["a1", "a2", "a3"]);
    expect(result.results.map((r) => r.actionId)).toEqual(["a1", "a2", "a3"]);
  });

  it("retorna PARTIAL quando ha sucesso e falha", async () => {
    const engine = buildEngine((r) =>
      r.register(new TaskActionExecutor()).register(new FailingExecutor()),
    );

    const result = await engine.execute(
      plan([
        action({ id: "a1", type: ActionType.CREATE_TASK }),
        action({ id: "a2", type: ActionType.UPDATE_TASK }),
      ]),
    );

    expect(result.status).toBe(ExecutionStatus.PARTIAL);
    expect(result.executed).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
  });

  it("registra logs de inicio, fim, tempo e executor utilizado", async () => {
    const engine = buildEngine((r) => r.register(new TaskActionExecutor()));

    const result = await engine.execute(
      plan([action({ id: "a1", type: ActionType.CREATE_TASK })]),
    );

    const phases = result.logs.map((l) => l.phase);
    expect(phases).toContain(ExecutionPhase.PLAN_VALIDATED);
    expect(phases).toContain(ExecutionPhase.ACTION_START);
    expect(phases).toContain(ExecutionPhase.ACTION_FINISH);
    expect(phases).toContain(ExecutionPhase.EXECUTION_FINISH);

    const finish = result.logs.find(
      (l) => l.phase === ExecutionPhase.ACTION_FINISH,
    );
    expect(finish?.executor).toBe("task.create");
    expect(typeof finish?.durationMs).toBe("number");
  });

  it("interrompe na primeira falha quando stopOnError e true", async () => {
    const order: string[] = [];
    const engine = buildEngine(
      (r) =>
        r
          .register(new FailingExecutor())
          .register(new RecordingExecutor(ActionType.LOG, order)),
      { stopOnError: true },
    );

    const result = await engine.execute(
      plan([
        action({ id: "a1", type: ActionType.UPDATE_TASK }),
        action({ id: "a2", type: ActionType.LOG }),
      ]),
    );

    expect(result.results).toHaveLength(1);
    expect(order).toEqual([]);
  });

  it("persiste o resultado no ExecutionStore quando fornecido", async () => {
    const store: ExecutionStore = { save: vi.fn().mockResolvedValue(undefined) };
    const engine = buildEngine((r) => r.register(new TaskActionExecutor()), {
      store,
    });

    const result = await engine.execute(
      plan([action({ id: "a1", type: ActionType.CREATE_TASK })]),
    );

    expect(store.save).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledWith(result);
  });

  it("lanca InvalidExecutionPlanError para id de acao duplicado", async () => {
    const engine = buildEngine((r) => r.register(new TaskActionExecutor()));

    await expect(
      engine.execute(
        plan([
          action({ id: "dup", type: ActionType.CREATE_TASK }),
          action({ id: "dup", type: ActionType.CREATE_TASK }),
        ]),
      ),
    ).rejects.toBeInstanceOf(InvalidExecutionPlanError);
  });
});
