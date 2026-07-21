import type { CycleRecord, ExecutionSummary } from "@operaia/orchestration-engine";
import type { WorkspaceSessionStatus } from "./workspace-state.js";

/**
 * Sessao de trabalho de um agente dentro de um Workspace.
 * Reusa CycleRecord/ExecutionSummary da orquestracao: esta e a camada de
 * composicao, entao conhecer os tipos dos engines e intencional.
 */
export interface WorkspaceSession {
  readonly id: string;
  readonly workspaceId: string;
  readonly objective: string;
  status: WorkspaceSessionStatus;
  currentCycle: number;
  readonly startedAt: Date;
  finishedAt: Date | null;
  history: readonly CycleRecord[];
  executionSummary: ExecutionSummary | null;
}
