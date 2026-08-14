import type { Specialization } from "../employee/employee-specialization.js";

/** Pedido de delegacao: apenas a especialidade necessaria + motivo. */
export interface DelegationRequest {
  readonly specialization: Specialization;
  readonly reason: string;
  readonly task?: string;
}

/**
 * Modelo comum de decisao. Todo funcionario responde as mesmas perguntas:
 * o que analisou, o que decidiu, por que, o que recomenda, o que delega e
 * quais riscos identificou (+ proximas acoes concretas).
 */
export interface EmployeeDecision {
  readonly analyzed: string;
  readonly decision: string;
  readonly reasoning: string;
  readonly recommendations: readonly string[];
  readonly delegations: readonly DelegationRequest[];
  readonly risks: readonly string[];
  readonly nextActions: readonly string[];
  /**
   * Evidencias de tool/action realmente invocadas pelo brain (opcional).
   * Persistidas pelo MissionQueue executor — nao e narrativa.
   */
  readonly toolExecutions?: readonly EmployeeToolExecution[];
  /**
   * Entrega estruturada do trabalho (opcional).
   * Evidencias devem vir de tools reais — nao de narrativa LLM.
   */
  readonly delivery?: EmployeeDelivery;
}

/** Registro minimo de uma invocacao de tool (auditavel). */
export interface EmployeeToolExecution {
  readonly toolId: string;
  readonly success: boolean;
  readonly outcome: string;
  readonly at: string;
}

/** Evidencia anexada a uma delivery (dados reais de tool). */
export interface EmployeeDeliveryEvidence {
  readonly source: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Entrega verificavel (F4/F5 — sem framework).
 * status DELIVERED somente com evidencias validas.
 */
export interface EmployeeDelivery {
  readonly type: "technical_analysis" | "priority_recommendation";
  readonly status: "DELIVERED" | "FAILED";
  readonly missionId: string;
  readonly employeeId: string;
  readonly objective: string;
  readonly summary: string;
  readonly findings: readonly string[];
  readonly evidence: readonly EmployeeDeliveryEvidence[];
  readonly recommendations: readonly string[];
  readonly deliveredAt: string;
  /** Missao EXECUTE fonte (F5 — delivery encadeada). */
  readonly sourceMissionId?: string;
}
