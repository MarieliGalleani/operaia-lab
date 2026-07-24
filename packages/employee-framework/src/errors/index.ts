/** Hierarquia de erros do Employee Framework. */
export abstract class EmployeeFrameworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class BriefingValidationError extends EmployeeFrameworkError {
  constructor(public readonly issues: readonly string[]) {
    super(`Briefing invalido: ${issues.join("; ")}`);
  }
}

export class EmployeeNotFoundError extends EmployeeFrameworkError {
  constructor(id: string) {
    super(`Funcionario nao encontrado: ${id}`);
  }
}

export class EmployeeAlreadyRegisteredError extends EmployeeFrameworkError {
  constructor(id: string) {
    super(`Funcionario ja registrado: ${id}`);
  }
}
