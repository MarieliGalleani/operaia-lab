import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AuthService } from "./auth-service.js";
import { SESSION_COOKIE_NAME } from "./auth-guard.js";

const adminResponseSchema = z.object({
  id: z.string().uuid(),
  login: z.string(),
  role: z.literal("ADMIN"),
});

const authErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const loginBodySchema = z.object({
  login: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(1024),
});

function cookieOptions(secure: boolean, expires?: Date) {
  return {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path: "/",
    ...(expires ? { expires } : {}),
  };
}

export function createAuthRoutes(
  authService: AuthService,
  secureCookies: boolean,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.post(
      "/login",
      {
        config: {
          rateLimit: {
            max: 5,
            timeWindow: "1 minute",
          },
        },
        schema: {
          tags: ["auth"],
          body: loginBodySchema,
          response: {
            200: z.object({ user: adminResponseSchema }),
            401: authErrorSchema,
          },
        },
      },
      async (request, reply) => {
        const result = await authService.login(
          request.body.login,
          request.body.password,
        );
        if (!result) {
          return reply.code(401).send({
            code: "INVALID_CREDENTIALS",
            message: "Credenciais invalidas.",
          });
        }
        reply.setCookie(
          SESSION_COOKIE_NAME,
          result.sessionToken,
          cookieOptions(secureCookies, result.expiresAt),
        );
        return reply.code(200).send({ user: result.admin });
      },
    );

    app.post(
      "/logout",
      {
        preHandler: app.authenticateAdmin,
        schema: {
          tags: ["auth"],
          response: { 204: z.null() },
        },
      },
      async (request, reply) => {
        await authService.logout(request.cookies[SESSION_COOKIE_NAME]);
        reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions(secureCookies));
        return reply.code(204).send(null);
      },
    );

    app.get(
      "/me",
      {
        preHandler: app.authenticateAdmin,
        schema: {
          tags: ["auth"],
          response: {
            200: z.object({ user: adminResponseSchema }),
            401: authErrorSchema,
          },
        },
      },
      async (request) => ({ user: request.authenticatedAdmin! }),
    );
  };
}
