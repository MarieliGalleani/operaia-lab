import type { OrchestrationEvent } from "../events/orchestration-events.js";

/**
 * Publicador de eventos de orquestracao. Sera consumido futuramente por
 * dashboard, logs, n8n e monitoramento — sempre atraves desta interface.
 */
export interface EventPublisher {
  publish(event: OrchestrationEvent): Promise<void> | void;
}
