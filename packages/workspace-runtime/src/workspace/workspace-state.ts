import { OrchestrationStatus } from "@operaia/orchestration-engine";

/** Ciclo de vida de uma sessao de workspace. */
export const WorkspaceSessionStatus = {
  CREATED: "CREATED",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type WorkspaceSessionStatus =
  (typeof WorkspaceSessionStatus)[keyof typeof WorkspaceSessionStatus];

/**
 * Traduz o status da orquestracao para o status da sessao do workspace.
 * REPLANNING/CREATED/RUNNING colapsam em RUNNING (detalhe interno do loop).
 */
export function statusFromOrchestration(
  status: OrchestrationStatus,
): WorkspaceSessionStatus {
  switch (status) {
    case OrchestrationStatus.COMPLETED:
      return WorkspaceSessionStatus.COMPLETED;
    case OrchestrationStatus.FAILED:
      return WorkspaceSessionStatus.FAILED;
    case OrchestrationStatus.CANCELLED:
      return WorkspaceSessionStatus.CANCELLED;
    case OrchestrationStatus.WAITING:
      return WorkspaceSessionStatus.WAITING;
    default:
      return WorkspaceSessionStatus.RUNNING;
  }
}
