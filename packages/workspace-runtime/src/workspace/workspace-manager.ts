import { randomUUID } from "node:crypto";
import { systemClock, type Clock } from "@operaia/orchestration-engine";
import {
  SessionNotFoundError,
  WorkspaceNotFoundError,
} from "../errors/workspace-errors.js";
import type { SessionRunner } from "../ports/session-runner.js";
import type { SessionStore } from "../ports/session-store.js";
import type { WorkspaceLoader } from "../ports/workspace-loader.js";
import type { WorkspaceContext } from "./workspace-context.js";
import type { WorkspaceSession } from "./workspace-session.js";
import {
  statusFromOrchestration,
  WorkspaceSessionStatus,
} from "./workspace-state.js";

export interface WorkspaceManagerDependencies {
  readonly workspaceLoader: WorkspaceLoader;
  readonly sessionStore: SessionStore;
  readonly sessionRunner: SessionRunner;
  readonly clock?: Clock;
}

export interface StartSessionInput {
  readonly workspaceId: string;
  readonly objective: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly signal?: AbortSignal;
}

/**
 * Coordena o ciclo de vida de uma sessao dentro de um Workspace: carrega o
 * workspace, monta o contexto, abre a sessao, executa um ciclo completo via
 * orquestracao e persiste o estado. Nao conhece engines concretos (usa ports).
 */
export class WorkspaceManager {
  private readonly workspaceLoader: WorkspaceLoader;
  private readonly sessionStore: SessionStore;
  private readonly sessionRunner: SessionRunner;
  private readonly clock: Clock;

  constructor(deps: WorkspaceManagerDependencies) {
    this.workspaceLoader = deps.workspaceLoader;
    this.sessionStore = deps.sessionStore;
    this.sessionRunner = deps.sessionRunner;
    this.clock = deps.clock ?? systemClock;
  }

  async startSession(input: StartSessionInput): Promise<WorkspaceSession> {
    const workspace = await this.workspaceLoader.load(input.workspaceId);
    if (!workspace) {
      throw new WorkspaceNotFoundError(input.workspaceId);
    }

    const context: WorkspaceContext = {
      workspace,
      objective: input.objective,
      metadata: {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        ...(input.metadata ?? {}),
      },
    };

    const session: WorkspaceSession = {
      id: randomUUID(),
      workspaceId: workspace.id,
      objective: input.objective,
      status: WorkspaceSessionStatus.CREATED,
      currentCycle: 0,
      startedAt: this.clock.now(),
      finishedAt: null,
      history: [],
      executionSummary: null,
    };
    await this.sessionStore.save(session);

    session.status = WorkspaceSessionStatus.RUNNING;
    await this.sessionStore.save(session);

    const result = await this.sessionRunner.run({
      objective: context.objective,
      sessionId: session.id,
      metadata: context.metadata,
      signal: input.signal,
    });

    session.status = statusFromOrchestration(result.status);
    session.currentCycle = result.cycles;
    session.history = result.history;
    session.executionSummary = result.executionSummary;
    session.finishedAt = result.finishedAt;
    await this.sessionStore.save(session);

    return session;
  }

  async getSession(
    workspaceId: string,
    sessionId: string,
  ): Promise<WorkspaceSession> {
    const session = await this.sessionStore.load(sessionId);
    if (!session || session.workspaceId !== workspaceId) {
      throw new SessionNotFoundError(sessionId);
    }
    return session;
  }
}
