import { DomainError } from "@operaia/shared";

/**
 * Erros do Workspace Runtime. Estendem DomainError para integrar com o
 * error handler HTTP da API sem que a camada de transporte conheca detalhes.
 */
export class WorkspaceNotFoundError extends DomainError {
  readonly code = "WORKSPACE_NOT_FOUND";
  readonly httpStatus = 404;

  constructor(workspaceId: string) {
    super(`Workspace nao encontrado: ${workspaceId}`);
  }
}

export class SessionNotFoundError extends DomainError {
  readonly code = "SESSION_NOT_FOUND";
  readonly httpStatus = 404;

  constructor(sessionId: string) {
    super(`Sessao nao encontrada: ${sessionId}`);
  }
}

export class InvalidWorkspacePlanError extends DomainError {
  readonly code = "INVALID_WORKSPACE_PLAN";
  readonly httpStatus = 422;

  constructor(message: string) {
    super(message);
  }
}
