import type { LLMExecutionEvent } from "@operaia/ai-core";
import type { NormalizedActionResult } from "@operaia/execution-engine";
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

/** Auditoria do pipeline de execucao (Policy → Registry → Executor). */
export interface OperationalExecutionAudit {
  readonly planId: string;
  readonly status: string;
  readonly executionId: string;
  readonly durationMs: number;
  readonly results: readonly NormalizedActionResult[];
}

/**
 * Status do run Assisted.
 * - completed: ciclo Queue (ou Path A) terminou com sucesso
 * - in_progress / timed_out: missao na Queue ainda nao terminal (Fase 1 gateway)
 */
export type OperationalRunStatus =
  | "completed"
  | "in_progress"
  | "timed_out";

/**
 * Registro completo de uma missao assistida — auditavel ponta a ponta.
 * `id` no Path B = Mission.id persistido na Mission Queue.
 */
export interface OperationalRun {
  readonly id: string;
  readonly status: OperationalRunStatus;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly objective: string;
  readonly startedAt: string;
  /** Null enquanto a missao na fila ainda nao terminou. */
  readonly finishedAt: string | null;
  readonly mission: MissionResult;
  readonly reply: EmployeeReplyPayload;
  readonly workflow: WorkflowPayload;
  readonly llmEvents: readonly LLMExecutionEvent[];
  readonly gaps: readonly OperationalGap[];
  /** Texto pronto para o usuario (porta-voz Opera). */
  readonly usableResult: string;
  /** Resultado padronizado do Execution Engine (Fase 2.2). */
  readonly execution: OperationalExecutionAudit;
  /**
   * Metricas internas de tempo da missao (nao expostas no contrato HTTP publico).
   */
  readonly timing: {
    readonly ceoMs: number;
    readonly specialistMs: number;
    readonly consolidationMs: number;
    readonly totalMs: number;
  };
  /** Status bruto da Mission Queue quando o run e projecao intermediaria. */
  readonly queueStatus?: string;
}
