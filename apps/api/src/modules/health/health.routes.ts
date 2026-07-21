import { prisma } from "@operaia/database";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

/**
 * Endpoints de saude. Servem para orquestracao (Docker, n8n, uptime checks).
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        response: {
          200: z.object({ status: z.literal("ok") }),
        },
      },
    },
    async () => ({ status: "ok" as const }),
  );

  app.get(
    "/health/ready",
    {
      schema: {
        tags: ["health"],
        response: {
          200: z.object({ status: z.literal("ok"), database: z.literal("up") }),
        },
      },
    },
    async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok" as const, database: "up" as const };
    },
  );
};
