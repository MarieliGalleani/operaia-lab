import { validateBriefing } from "../briefing/briefing-validator.js";
import type { EmployeeInput } from "../contracts/employee-input.js";
import type { EmployeeOutput } from "../contracts/employee-output.js";
import type { DelegationPolicy } from "../decision/delegation-policy.js";
import type { QualityPolicy } from "../decision/quality-policy.js";
import type { ResponsePolicy } from "../decision/response-policy.js";
import type { Employee, EmployeeBrain } from "./employee-contract.js";
import type { EmployeeProfile } from "./employee-profile.js";

export interface EmployeePolicies {
  readonly responsePolicy: ResponsePolicy;
  readonly qualityPolicy: QualityPolicy;
  readonly delegationPolicy: DelegationPolicy;
}

/**
 * Motor reutilizavel de TODO funcionario. Aplica o mesmo pipeline ao redor de
 * um EmployeeBrain especializado:
 *
 *   validar briefing -> decidir (brain) -> resolver delegacoes ->
 *   montar resposta -> validar qualidade
 *
 * Novos funcionarios nao reimplementam esse fluxo: apenas fornecem o brain.
 */
export class BaseEmployee implements Employee {
  constructor(
    readonly profile: EmployeeProfile,
    private readonly brain: EmployeeBrain,
    private readonly policies: EmployeePolicies,
  ) {}

  async work(input: EmployeeInput): Promise<EmployeeOutput> {
    validateBriefing(input.briefing);

    const raw = await this.brain.decide(input.briefing);
    const delegations = this.policies.delegationPolicy.resolve(
      raw.delegations,
      this.profile,
    );
    const decision = { ...raw, delegations };

    const report = this.policies.responsePolicy.build(decision, input.briefing);
    const quality = this.policies.qualityPolicy.validate(
      decision,
      report,
      this.profile,
    );

    return { decision, report, quality };
  }
}
