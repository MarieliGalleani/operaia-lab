/**
 * Hierarquia de erros de dominio.
 * A camada de transporte (HTTP) traduz esses erros para status codes,
 * sem que o dominio conheca detalhes de infraestrutura.
 */

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;

  constructor(resource: string, id: string) {
    super(`${resource} nao encontrado: ${id}`);
  }
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";
  readonly httpStatus = 422;

  constructor(message: string) {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly code = "CONFLICT";
  readonly httpStatus = 409;

  constructor(message: string) {
    super(message);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
