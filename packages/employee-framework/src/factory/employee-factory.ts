import type { DelegationPolicy } from "../decision/delegation-policy.js";
import type { QualityPolicy } from "../decision/quality-policy.js";
import type { ResponsePolicy } from "../decision/response-policy.js";
import { DefaultDelegationPolicy } from "../defaults/default-delegation-policy.js";
import { DefaultQualityPolicy } from "../defaults/default-quality-policy.js";
import { DefaultResponsePolicy } from "../defaults/default-response-policy.js";
import { BaseEmployee } from "../employee/base-employee.js";
import type { Employee, EmployeeBrain } from "../employee/employee-contract.js";
import type { EmployeeProfile } from "../employee/employee-profile.js";

/**
 * Blueprint de um funcionario: perfil + como construir o brain (com deps de
 * runtime, ex.: LLM) + politicas opcionais. Criar um funcionario e declarar
 * este blueprint; a Factory cuida do resto.
 */
export interface EmployeeBlueprint<TDeps = void> {
  readonly profile: EmployeeProfile;
  readonly build: (dependencies: TDeps) => EmployeeBrain;
  readonly responsePolicy?: ResponsePolicy;
  readonly qualityPolicy?: QualityPolicy;
  readonly delegationPolicy?: DelegationPolicy;
}

/**
 * Instancia funcionarios a partir de um blueprint, preenchendo as politicas
 * padrao. Nenhum funcionario deve ser montado manualmente fora daqui.
 */
export class EmployeeFactory {
  create<TDeps>(
    blueprint: EmployeeBlueprint<TDeps>,
    dependencies: TDeps,
  ): Employee {
    return new BaseEmployee(blueprint.profile, blueprint.build(dependencies), {
      responsePolicy: blueprint.responsePolicy ?? new DefaultResponsePolicy(),
      qualityPolicy: blueprint.qualityPolicy ?? new DefaultQualityPolicy(),
      delegationPolicy:
        blueprint.delegationPolicy ?? new DefaultDelegationPolicy(),
    });
  }
}
