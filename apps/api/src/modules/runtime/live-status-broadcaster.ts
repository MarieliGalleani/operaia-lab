/**
 * Broadcaster de status ao vivo — WebSocket (P1.23).
 *
 * Antes, o status busy/available de um agente so era buscado quando o
 * mapa do escritorio virtual carregava (ver live-agent-status.ts) —
 * "nao existe push continuo enquanto o usuario esta parado num andar".
 * Este broadcaster fecha essa lacuna: o EmployeeWorker chama
 * broadcastLiveStatus nos mesmos pontos onde ja loga mission_started/
 * mission_completed/mission_failed, e cada cliente WS conectado recebe
 * o evento na hora — o front reage recarregando o andar atual (mesmo
 * fetch de sempre, so que disparado pelo servidor em vez de manual).
 *
 * Nao e um event bus geral — so essa unica finalidade, de proposito
 * (evita inventar infra generica sem outro consumidor real ainda).
 */
import type { WebSocket } from "ws";

export interface LiveStatusEvent {
  readonly employeeId: string;
  readonly busy: boolean;
  readonly objective: string | null;
}

const clients = new Set<WebSocket>();

export function subscribeLiveStatus(socket: WebSocket): void {
  clients.add(socket);
  socket.on("close", () => {
    clients.delete(socket);
  });
}

export function broadcastLiveStatus(event: LiveStatusEvent): void {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

/** Só para testes — não usar em produção. */
export function _clientCountForTests(): number {
  return clients.size;
}
