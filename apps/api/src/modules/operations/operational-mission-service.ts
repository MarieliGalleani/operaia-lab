import { randomUUID } from "node:crypto";
import type { RecordingLLMObserver } from "@operaia/ai-core";
import type { MemoryStore } from "@operaia/memory";
import type { DigitalOffice } from "../employees/office-composition.js";
import { MissionOrchestrator } from "../employees/mission-orchestrator.js";
import { presentMissionResult } from "../employees/mission-presenter.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import { identifyOperationalGaps } from "./identify-operational-gaps.js";
import {
  loadMissionMemoryNotes,
  persistMissionMemory,
} from "./mission-memory.js";
import type { MissionExecutionStack } from "./mission-execution.js";
import type { OperationalRun } from "./operational-run.js";
import type { OperationalRunStore } from "./operational-run-store.js";

export interface RunOperationalMissionInput {
  readonly workspaceId: string;
  readonly objective: string;
  /** Employee porta-voz (default: Opera). */
  readonly employeeId?: string;
}

/**
 * Ciclo operacional assistido:
 * Memory → MissionOrchestrator (+ Execution Engine) → OperationalRun.
 */
export class OperationalMissionService {
  private readonly orchestrator: MissionOrchestrator;

  constructor(
    private readonly office: DigitalOffice,
    private readonly workspaces: WorkspaceSource,
    private readonly observer: RecordingLLMObserver,
    private readonly store: OperationalRunStore,
    private readonly memory: MemoryStore,
    execution: MissionExecutionStack,
  ) {
    this.orchestrator = new MissionOrchestrator(office, execution);
  }

  async run(input: RunOperationalMissionInput): Promise<OperationalRun> {
    const workspace = await this.workspaces.getWorkspace(input.workspaceId);
    const snapshot = await this.workspaces.toSnapshot(input.workspaceId);
    if (!workspace || !snapshot) {
      throw new Error(`Workspace nao encontrado: ${input.workspaceId}`);
    }

    this.observer.clear();
    const startedAt = new Date().toISOString();
    const employeeId = input.employeeId ?? "operaia-ceo";
    const missionId = randomUUID();

    const memoryNotes = await loadMissionMemoryNotes(this.memory, {
      workspaceId: input.workspaceId,
      objective: input.objective,
    });

    const mission = await this.orchestrator.run(employeeId, {
      workspace: snapshot,
      objective: input.objective,
      memoryNotes,
    });

    const finishedAt = new Date().toISOString();
    const llmEvents = this.observer.snapshot();
    const presented = presentMissionResult(
      mission,
      input.workspaceId,
      workspace.name,
    );
    const gaps = identifyOperationalGaps(mission, llmEvents);

    const run: OperationalRun = {
      id: missionId,
      status: "completed",
      workspaceId: input.workspaceId,
      workspaceName: workspace.name,
      objective: input.objective,
      startedAt,
      finishedAt,
      mission,
      reply: presented.reply,
      workflow: presented.workflow,
      llmEvents,
      gaps,
      usableResult: presented.reply.content,
      execution: {
        planId: mission.executionPlan.id,
        status: mission.executionResult.status,
        executionId: mission.executionResult.executionId,
        durationMs: mission.executionResult.durationMs,
        results: mission.executionSummaries,
      },
      timing: mission.timing,
    };

    await persistMissionMemory(this.memory, {
      workspaceId: input.workspaceId,
      missionId: run.id,
      objective: input.objective,
      summary: run.usableResult,
    });

    this.store.save(run);
    return run;
  }

  get(id: string): OperationalRun | undefined {
    return this.store.get(id);
  }

  list(): readonly OperationalRun[] {
    return this.store.list();
  }
}
