import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  BusinessImportError,
  deleteImport,
  getDashboard,
  importSalesCsv,
  listImports,
} from "./business.service.js";

/** 8 MB de texto ≈ 50 mil vendas com nomes longos. */
export const MAX_SALES_CSV_BYTES = 8_000_000;

export const businessImportBodySchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  csv: z.string().min(1).max(MAX_SALES_CSV_BYTES),
});

/** Tabela ainda nao criada (migration nao aplicada na VM). */
function isMissingTable(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return e?.code === "P2021" || /business_(imports|sales).*does not exist|relation .*business_/i.test(String(e?.message ?? ""));
}

const MISSING_TABLE = {
  code: "ANDAR_SEM_BANCO",
  message: "O andar Negócio ainda não tem as tabelas no banco. Rode a migration (pnpm --filter @operaia/database migrate:deploy) e tente de novo.",
} as const;

/**
 * Andar 05 · Negócio — planilha de vendas -> receita, margem, clientes em
 * risco e o que fazer primeiro.
 */
export const businessRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/business/dashboard", {}, async (_request, reply) => {
    try {
      return await getDashboard();
    } catch (error) {
      if (isMissingTable(error)) return reply.status(503).send(MISSING_TABLE);
      throw error;
    }
  });

  app.get("/business/imports", {}, async (_request, reply) => {
    try {
      return await listImports();
    } catch (error) {
      if (isMissingTable(error)) return reply.status(503).send(MISSING_TABLE);
      throw error;
    }
  });

  app.post(
    "/business/imports",
    {
      bodyLimit: MAX_SALES_CSV_BYTES + 64_000,
      schema: { tags: ["business"], body: businessImportBodySchema },
    },
    async (request, reply) => {
      try {
        const summary = await importSalesCsv({
          fileName: request.body.fileName,
          csv: request.body.csv,
          createdBy: request.authenticatedAdmin?.login ?? null,
        });
        return reply.status(201).send(summary);
      } catch (error) {
        if (error instanceof BusinessImportError) {
          return reply.status(400).send({ code: "PLANILHA_INVALIDA", message: error.message });
        }
        if (isMissingTable(error)) return reply.status(503).send(MISSING_TABLE);
        throw error;
      }
    },
  );

  app.delete(
    "/business/imports/:id",
    { schema: { tags: ["business"], params: z.object({ id: z.string().min(1).max(64) }) } },
    async (request, reply) => {
      const removed = await deleteImport(request.params.id);
      if (!removed) {
        return reply.status(404).send({ code: "NAO_ENCONTRADO", message: "Essa importação não existe mais." });
      }
      return { ok: true };
    },
  );
};
