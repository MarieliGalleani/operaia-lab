import type {
  EmployeeRegistry,
  RegisteredEmployee,
  Specialization,
} from "@operaia/employee-framework";

/**
 * Resolve uma ESPECIALIDADE em um funcionario concreto.
 *
 * Funcionarios nunca escolhem outro funcionario diretamente: eles informam a
 * especialidade necessaria e o Matcher consulta o Registry. Assim a resolucao
 * de "quem executa" vive fora do dominio dos funcionarios.
 */
export class EmployeeMatcher {
  constructor(private readonly registry: EmployeeRegistry) {}

  /** Primeiro funcionario compativel com a especialidade (ou undefined). */
  match(specialization: Specialization): RegisteredEmployee | undefined {
    return this.registry
      .all()
      .find((entry) => entry.profile.specialization === specialization);
  }

  /** Todos os funcionarios compativeis com a especialidade. */
  matchAll(specialization: Specialization): readonly RegisteredEmployee[] {
    return this.registry
      .all()
      .filter((entry) => entry.profile.specialization === specialization);
  }
}
