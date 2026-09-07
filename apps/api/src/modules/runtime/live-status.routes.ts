import websocketPlugin from "@fastify/websocket";
import type { FastifyPluginAsync } from "fastify";
import { subscribeLiveStatus } from "./live-status-broadcaster.js";

/**
 * /ws/live-status — registrado dentro do mesmo protectedApi de
 * app.ts, entao herda a mesma sessao/cookie de autenticacao das
 * rotas REST (o handshake HTTP do WebSocket passa pelos mesmos hooks).
 */
export const liveStatusRoutes: FastifyPluginAsync = async (app) => {
  await app.register(websocketPlugin);

  app.get("/live-status", { websocket: true }, (socket) => {
    subscribeLiveStatus(socket);
  });
};
