import { prisma } from "@operaia/database";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

/**
 * Leitura dos sinais de dominio (Interface 3.0 — aba Sinais).
 *
 * So leitura: lista os sinais ja capturados (GitHub, webhooks) com a
 * decisao que o gate tomou. O payload ja chega redigido na ingestao;
 * aqui so extraimos um resumo curto para a tela.
 */

const signalItemSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  sourceType: z.string(),
  type: z.string(),
  summary: z.string(),
  status: z.string(),
  decision: z.string().nullable(),
  reason: z.string().nullable(),
  missionId: z.string().nullable(),
  receivedAt: z.string(),
});

export type SignalListItem = z.infer<typeof signalItemSchema>;

const TEXT_KEYS = ["title", "summary", "message", "headline", "name", "ref", "branch"] as const;

export function summarizePayload(type: string, payload: unknown): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim().slice(0, 160);
    }
    for (const nested of ["pullRequest", "pull_request", "issue", "commit", "head_commit", "repository"]) {
      const inner = record[nested];
      if (inner && typeof inner === "object") {
        const innerRecord = inner as Record<string, unknown>;
        for (const key of TEXT_KEYS) {
          const value = innerRecord[key];
          if (typeof value === "string" && value.trim()) return value.trim().slice(0, 160);
        }
      }
    }
  }
  return type;
}

export const signalsReadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/signals",
    {
      schema: {
        tags: ["signals"],
        querystring: z.object({
          workspaceId: z.string().optional(),
          take: z.coerce.number().int().min(1).max(200).default(50),
        }),
        response: { 200: z.object({ signals: z.array(signalItemSchema) }) },
      },
    },
    async (request) => {
      const { workspaceId, take } = request.query;
      const rows = await prisma.domainSignal.findMany({
        where: workspaceId ? { workspaceId } : undefined,
        orderBy: { receivedAt: "desc" },
        take,
        select: {
          id: true,
          workspaceId: true,
          sourceType: true,
          type: true,
          status: true,
          evaluationDecision: true,
          evaluationReason: true,
          missionId: true,
          receivedAt: true,
          payloadJson: true,
        },
      });
      return {
        signals: rows.map((r) => ({
          id: r.id,
          workspaceId: r.workspaceId,
          sourceType: r.sourceType,
          type: r.type,
          summary: summarizePayload(r.type, r.payloadJson),
          status: String(r.status),
          decision: r.evaluationDecision ? String(r.evaluationDecision) : null,
          reason: r.evaluationReason,
          missionId: r.missionId,
          receivedAt: r.receivedAt.toISOString(),
        })),
      };
    },
  );
};
