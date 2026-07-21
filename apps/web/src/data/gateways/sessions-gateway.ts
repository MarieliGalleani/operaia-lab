import type { SessionDTO, SessionStateDTO } from "@/data/dto";

/**
 * Porta para **Sessions**: abrir e acompanhar execuções de objetivos dentro
 * de um Workspace. Mapeia diretamente aos endpoints já existentes da API.
 */
export interface SessionsGateway {
  startSession(workspaceId: string, objective: string): Promise<SessionDTO>;
  getSession(workspaceId: string, sessionId: string): Promise<SessionStateDTO>;
  listSessions(workspaceId: string): Promise<readonly SessionDTO[]>;
}
