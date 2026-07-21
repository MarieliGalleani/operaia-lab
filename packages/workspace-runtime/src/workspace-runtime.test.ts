import type { RuntimeResponse } from "@operaia/agent-runtime";
import {
  ActionStatus,
  type ExecutionEngine,
  type ExecutionResult,
} from "@operaia/execution-engine";
import {
  ExecutionOutcomeStatus,
  OrchestrationStatus,
  type Clock,
  type OrchestrationResult,
} from "@operaia/orchestration-engine";
import { Priority } from "@operaia/shared";
import { describe, expect, it } from "vitest";
import { ExecutionAdapter } from "./adapters/execution-adapter.js";
import { createWorkspaceRuntime } from "./composition/composition-root.js";
import { PlanMapper } from "./composition/plan-mapper.js";
import { InMemorySessionStore } from "./defaults/in-memory-session-store.js";
import { InMemoryWorkspaceStore } from "./defaults/in-memory-workspace-store.js";
import {
  SessionNotFoundError,
  WorkspaceNotFoundError,
} from "./errors/workspace-errors.js";
import type { SessionRunInput, SessionRunner } from "./ports/session-runner.js";
import type { Workspace } from "./workspace/workspace.js";
import { WorkspaceManager } from "./workspace/workspace-manager.js";
import { WorkspaceSessionStatus } from "./workspace/workspace-state.js";

// --- helpers ---------------------------------------------------------------

class FixedClock implements Clock {
  private value = 0;
  now(): Date {
    this.value += 1000;
    return new Date(this.value);
  }
}

function makeRuntimeResponse(
  actions: RuntimeResponse["actions"],
  output = "ok",
): RuntimeResponse {
  return {
    output,
    plan: { agentKey: "x", steps: [], createdAt: new Date() },
    actions,
    usage: null,
    logs: [],
  } as unknown as RuntimeResponse;
}

function nexo(): Workspace {
  return { id: "nexo", name: "NEXO", createdAt: new Date(0) };
}

class StubSessionRunner implements SessionRunner {
  public lastInput: SessionRunInput | null = null;
  constructor(private readonly result: Omit<OrchestrationResult, "id">) {}
  async run(input: SessionRunInput): Promise<OrchestrationResult> {
    this.lastInput = input;
    return { id: input.sessionId, ...this.result };
  }
}

function completedResult(): Omit<OrchestrationResult, "id"> {
  return {
    status: OrchestrationStatus.COMPLETED,
    cycles: 2,
    history: [],
    startedAt: new Date(0),
    finishedAt: new Date(2000),
    duration: 2000,
    objectiveCompleted: true,
    executionSummary: {
      status: ExecutionOutcomeStatus.SUCCESS,
      executed: 1,
      failed: 0,
      durationMs: 5,
    },
  };
}

function buildManager(runner: SessionRunner): {
  manager: WorkspaceManager;
  sessions: InMemorySessionStore;
} {
  const sessions = new InMemorySessionStore();
  const workspaces = new InMemoryWorkspaceStore([nexo()]);
  const manager = new WorkspaceManager({
    workspaceLoader: workspaces,
    sessionStore: sessions,
    sessionRunner: runner,
    clock: new FixedClock(),
  });
  return { manager, sessions };
}

// --- PlanMapper ------------------------------------------------------------

describe("PlanMapper", () => {
  it("traduz actions do runtime em um ExecutionPlan executavel", () => {
    const mapper = new PlanMapper();
    const response = makeRuntimeResponse([
      { type: "CREATE_TASK", payload: { description: "Criar X", priority: "HIGH" } },
      { type: "LOG", payload: {} },
    ]);

    const plan = mapper.toExecutionPlan(response);

    expect(plan.actions).toHaveLength(2);
    expect(plan.actions[0]).toMatchObject({
      type: "CREATE_TASK",
      description: "Criar X",
      priority: Priority.HIGH,
      status: ActionStatus.PENDING,
    });
    expect(plan.actions[1]).toMatchObject({
      type: "LOG",
      description: "Acao LOG",
      priority: Priority.MEDIUM,
    });
  });

  it("gera um plano vazio quando o agente nao propoe acoes", () => {
    const plan = new PlanMapper().toExecutionPlan(makeRuntimeResponse([]));
    expect(plan.actions).toHaveLength(0);
  });
});

// --- ExecutionAdapter ------------------------------------------------------

describe("ExecutionAdapter", () => {
  const result: ExecutionResult = {
    executionId: "exec-1",
    status: "SUCCESS",
    executed: [{}, {}] as unknown as ExecutionResult["executed"],
    failed: [] as unknown as ExecutionResult["failed"],
    results: [] as unknown as ExecutionResult["results"],
    durationMs: 42,
    logs: [],
  };

  it("converte ExecutionResult em ExecutionSummary neutro", async () => {
    const engine = {
      execute: async () => result,
    } as unknown as ExecutionEngine;
    const adapter = new ExecutionAdapter(engine);

    const summary = await adapter.execute({
      id: "p1",
      actionCount: 2,
      payload: { id: "p1", actions: [{}, {}] },
    });

    expect(summary).toEqual({
      status: ExecutionOutcomeStatus.SUCCESS,
      executed: 2,
      failed: 0,
      durationMs: 42,
    });
  });

  it("rejeita um payload que nao e um ExecutionPlan valido", async () => {
    const engine = { execute: async () => result } as unknown as ExecutionEngine;
    const adapter = new ExecutionAdapter(engine);
    await expect(
      adapter.execute({ id: "p1", actionCount: 0, payload: null }),
    ).rejects.toThrow(/ExecutionPlan/);
  });
});

// --- WorkspaceManager ------------------------------------------------------

describe("WorkspaceManager", () => {
  it("falha ao abrir sessao em workspace inexistente", async () => {
    const { manager } = buildManager(new StubSessionRunner(completedResult()));
    await expect(
      manager.startSession({ workspaceId: "nao-existe", objective: "obj" }),
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });

  it("abre uma sessao, executa o ciclo e persiste o estado final", async () => {
    const runner = new StubSessionRunner(completedResult());
    const { manager, sessions } = buildManager(runner);

    const session = await manager.startSession({
      workspaceId: "nexo",
      objective: "Organizar backlog",
    });

    expect(session.workspaceId).toBe("nexo");
    expect(session.status).toBe(WorkspaceSessionStatus.COMPLETED);
    expect(session.currentCycle).toBe(2);
    expect(session.executionSummary?.executed).toBe(1);
    expect(session.finishedAt).not.toBeNull();
    // o sessionId e propagado como id da orquestracao
    expect(runner.lastInput?.sessionId).toBe(session.id);
    // metadados do workspace sao montados no contexto
    expect(runner.lastInput?.metadata).toMatchObject({
      workspaceId: "nexo",
      workspaceName: "NEXO",
    });

    const persisted = await sessions.load(session.id);
    expect(persisted?.status).toBe(WorkspaceSessionStatus.COMPLETED);
  });

  it("recupera uma sessao existente e valida o workspace", async () => {
    const { manager } = buildManager(new StubSessionRunner(completedResult()));
    const session = await manager.startSession({
      workspaceId: "nexo",
      objective: "obj",
    });

    const fetched = await manager.getSession("nexo", session.id);
    expect(fetched.id).toBe(session.id);

    await expect(
      manager.getSession("outro-workspace", session.id),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it("suporta multiplas sessoes no mesmo workspace", async () => {
    const { manager, sessions } = buildManager(
      new StubSessionRunner(completedResult()),
    );

    const a = await manager.startSession({ workspaceId: "nexo", objective: "a" });
    const b = await manager.startSession({ workspaceId: "nexo", objective: "b" });

    expect(a.id).not.toBe(b.id);
    const list = await sessions.listByWorkspace("nexo");
    expect(list).toHaveLength(2);
  });
});

// --- Composition Root (ciclo completo end-to-end) --------------------------

describe("createWorkspaceRuntime (composition root)", () => {
  it("monta o stack completo e conclui um ciclo com os placeholders", async () => {
    const { manager } = createWorkspaceRuntime({
      initialWorkspaces: [nexo()],
      clock: new FixedClock(),
    });

    const session = await manager.startSession({
      workspaceId: "nexo",
      objective: "Planejar sprint do NEXO",
    });

    expect(session.status).toBe(WorkspaceSessionStatus.COMPLETED);
    expect(session.currentCycle).toBeGreaterThanOrEqual(1);
    expect(session.executionSummary).not.toBeNull();
  });

  it("persiste e isola sessoes de workspaces distintos", async () => {
    const { manager, sessionStore } = createWorkspaceRuntime({
      initialWorkspaces: [
        nexo(),
        { id: "menuflow", name: "MenuFlow", createdAt: new Date(0) },
      ],
    });

    await manager.startSession({ workspaceId: "nexo", objective: "x" });
    await manager.startSession({ workspaceId: "menuflow", objective: "y" });

    expect(await sessionStore.listByWorkspace("nexo")).toHaveLength(1);
    expect(await sessionStore.listByWorkspace("menuflow")).toHaveLength(1);
  });
});
