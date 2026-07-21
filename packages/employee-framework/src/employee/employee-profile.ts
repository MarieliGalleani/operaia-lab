import type { Specialization } from "./employee-specialization.js";

/**
 * Perfil declarativo de um funcionario digital (dados puros).
 *
 * Consolida role, mission, capabilities, permissions, limits, specialization e
 * qualityRules em um unico contrato: criar um funcionario e preencher este
 * perfil + um EmployeeBrain, nunca escrever infraestrutura.
 */
export interface EmployeeProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly mission: string;
  readonly specialization: Specialization;
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly limits: readonly string[];
  readonly qualityRules: readonly string[];
}
