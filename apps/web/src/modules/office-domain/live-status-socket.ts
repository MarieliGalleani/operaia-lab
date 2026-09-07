/**
 * Cliente do WebSocket de status ao vivo (P1.23).
 *
 * Antes, o escritório virtual só sabia quem estava ocupado/disponível no
 * momento em que o mapa carregava — sem push contínuo. Este cliente
 * conecta em /api/v1/ws/live-status e chama `onEvent` a cada mudança real
 * (worker inicia/termina/falha uma missão), pra quem estiver olhando a
 * tela reagir na hora, sem precisar trocar de andar ou clicar em
 * "Atualizar" pra ver o estado novo.
 *
 * Reconecta sozinho com backoff simples; falha de socket nunca derruba a
 * tela — só significa "sem tempo real até a próxima tentativa".
 */
import { resolveApiV1BaseUrl } from "@/data/adapters/http-client";

export interface LiveStatusEvent {
  readonly employeeId: string;
  readonly busy: boolean;
  readonly objective: string | null;
}

function wsUrl(): string {
  const base = resolveApiV1BaseUrl();
  return base.replace(/^http/, "ws") + "/ws/live-status";
}

export interface LiveStatusSocketHandlers {
  readonly onEvent: (event: LiveStatusEvent) => void;
  /** Opcional — pra UI mostrar "ao vivo" só quando a conexão está de pé. */
  readonly onConnectionChange?: (connected: boolean) => void;
}

export function connectLiveStatusSocket(
  handlers: LiveStatusSocketHandlers,
): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retryMs = 2000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (stopped) return;
    socket = new WebSocket(wsUrl());
    socket.onopen = () => {
      retryMs = 2000;
      handlers.onConnectionChange?.(true);
    };
    socket.onmessage = (message) => {
      try {
        handlers.onEvent(JSON.parse(message.data as string) as LiveStatusEvent);
      } catch (error) {
        console.log("[live-status-socket] evento invalido, ignorado", error);
      }
    };
    socket.onclose = () => {
      handlers.onConnectionChange?.(false);
      if (stopped) return;
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 30_000);
    };
    socket.onerror = () => {
      socket?.close();
    };
  }

  connect();

  return function disconnect(): void {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
