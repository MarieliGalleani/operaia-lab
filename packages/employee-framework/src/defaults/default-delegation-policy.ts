import type { DelegationPolicy } from "../decision/delegation-policy.js";
import type { DelegationRequest } from "../decision/decision-model.js";
import type { EmployeeProfile } from "../employee/employee-profile.js";

/**
 * Delegacao padrao: remove pedidos para a propria especialidade e deduplica.
 * Nunca resolve QUEM executa; apenas normaliza a especialidade solicitada.
 */
export class DefaultDelegationPolicy implements DelegationPolicy {
  resolve(
    requests: readonly DelegationRequest[],
    profile: EmployeeProfile,
  ): readonly DelegationRequest[] {
    const seen = new Set<string>();
    return requests.filter((request) => {
      if (request.specialization === profile.specialization) {
        return false;
      }
      const key = `${request.specialization}:${request.reason}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
