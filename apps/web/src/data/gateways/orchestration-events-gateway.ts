import type { OrchestrationEventDTO } from "@/data/dto";

/**
 * Porta para **Orchestration Events**: o fluxo de eventos do ciclo de vida
 * coordenado (planos, briefings, delegações, revisões).
 *
 * `subscribe` é opcional e prepara o terreno para tempo real (SSE/WebSocket)
 * sem exigir que todas as implementações o suportem hoje.
 */
export interface OrchestrationEventsGateway {
  listEvents(workspaceId?: string): Promise<readonly OrchestrationEventDTO[]>;
  subscribe?(handler: (event: OrchestrationEventDTO) => void): () => void;
}
