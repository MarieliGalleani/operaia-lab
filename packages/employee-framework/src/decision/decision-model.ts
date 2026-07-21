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
}
