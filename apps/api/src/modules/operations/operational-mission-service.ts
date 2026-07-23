import { randomUUID } from "node:crypto";
import type { RecordingLLMObserver } from "@operaia/ai-core";
import type { DigitalOffice } from "../employees/office-composition.js";
import { MissionOrchestrator } from "../employees/mission-orchestrator.js";
import { presentMissionResult } from "../employees/mission-presenter.js";
import type { WorkspaceSource } from "../employees/workspace-source.js";
import { identifyOperationalGaps } from "./identify-operational-gaps.js";
import type { OperationalRun } from "./operational-run.js";
import type { OperationalRunStore } from "./operational-run-store.js";

export interface RunOperationalMissionInput {
  readonly workspaceId: string;
  readonly objective: string;
  /** Employee porta-voz (default: Opera). */
  readonly employeeId?: string;
}

/**
 * Ciclo operacional assistido: executa MissionOrchestrator e registra
 * missao, decisoes, delegacoes, respostas e eventos LLM.
 */
export class OperationalMissionService {
  private readonly orchestrator: MissionOrchestrator;

  constructor(
    private readonly office: DigitalOffice,
    private readonly workspaces: WorkspaceSource,
    private readonly observer: RecordingLLMObserver,
    private readonly store: OperationalRunStore,
  ) {
    this.orchestrator = new MissionOrchestrator(office);
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

    const mission = await this.orchestrator.run(employeeId, {
      workspace: snapshot,
      objective: input.objective,
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
      id: randomUUID(),
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
    };

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
