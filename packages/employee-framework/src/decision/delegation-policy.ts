import type { EmployeeProfile } from "../employee/employee-profile.js";
import type { DelegationRequest } from "./decision-model.js";

/**
 * Politica plugavel de delegacao. Normaliza/valida pedidos, mas NUNCA escolhe
 * outro funcionario: a resolucao concreta acontece fora do dominio.
 */
export interface DelegationPolicy {
  resolve(
    requests: readonly DelegationRequest[],
    profile: EmployeeProfile,
  ): readonly DelegationRequest[];
}
