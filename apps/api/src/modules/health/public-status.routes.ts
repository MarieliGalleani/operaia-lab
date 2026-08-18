import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { HEALTH_RATE_LIMIT } from "../../shared/http-security.js";
import { resolvePublicStatus } from "./public-status.js";

/**
 * Status publico sanitizado para status.operaia.com.br.
 * Nao espelha production-readiness e nao exige sessao.
 */
export function createPublicStatusRoutes(
  probe?: () => void,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.get(
      "/api/status",
      {
        config: { rateLimit: HEALTH_RATE_LIMIT },
        schema: {
          tags: ["health"],
          response: {
            200: z.object({
              status: z.literal("ok"),
              service: z.literal("operaia"),
            }),
            503: z.object({
              status: z.literal("unavailable"),
            }),
          },
        },
      },
      async (_request, reply) => {
        try {
          const result = resolvePublicStatus(probe);
          if (result.httpStatus === 503) {
            return reply.code(503).send(result.body);
          }
          return result.body;
        } catch {
          return reply.code(503).send({ status: "unavailable" as const });
        }
      },
    );
  };
}

export const publicStatusRoutes = createPublicStatusRoutes();
