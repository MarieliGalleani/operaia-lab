import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { AuthService } from "./auth-service.js";
import type { AuthenticatedAdmin } from "./auth.types.js";

export const SESSION_COOKIE_NAME = "operaia_admin_session";

declare module "fastify" {
  interface FastifyRequest {
    authenticatedAdmin: AuthenticatedAdmin | null;
  }

  interface FastifyInstance {
    authenticateAdmin(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void>;
  }
}

export function registerAuthGuard(
  app: FastifyInstance,
  authService: AuthService,
): void {
  app.decorateRequest("authenticatedAdmin", null);
  app.decorate(
    "authenticateAdmin",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const admin = await authService.authenticate(
        request.cookies[SESSION_COOKIE_NAME],
      );
      if (!admin) {
        await reply.code(401).send({
          code: "UNAUTHORIZED",
          message: "Autenticacao necessaria.",
        });
        return;
      }
      request.authenticatedAdmin = admin;
    },
  );
}
