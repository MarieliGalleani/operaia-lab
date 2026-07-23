import type { LLMExecutionEvent } from "@operaia/ai-core";
import type {
  EmployeeReplyPayload,
  WorkflowPayload,
} from "../employees/mission-presenter.js";
import type { MissionResult } from "../employees/mission-orchestrator.js";

/** Lacuna operacional observada em uma missao controlada. */
export interface OperationalGap {
  readonly code: string;
  readonly severity: "info" | "warning" | "critical";
  readonly message: string;
}

/**
 * Registro completo de uma missao assistida — auditavel ponta a ponta.
 */
export interface OperationalRun {
  readonly id: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly objective: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly mission: MissionResult;
  readonly reply: EmployeeReplyPayload;
  readonly workflow: WorkflowPayload;
  readonly llmEvents: readonly LLMExecutionEvent[];
  readonly gaps: readonly OperationalGap[];
  /** Texto pronto para o usuario (porta-voz Opera). */
  readonly usableResult: string;
}
