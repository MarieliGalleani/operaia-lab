/**
 * Cerebro do Nicho (P1.X Fase 2) — memoria vetorial cross-cliente.
 *
 * Cada etapa de uma campanha bem-sucedida (conteudo real, nao fallback)
 * vira uma nota aqui. Campanhas futuras do MESMO nicho recuperam as
 * notas mais relevantes (por similaridade de cosseno, mesmo padrao de
 * OperationalMemoryNote) e recebem esse conteudo como contexto antes de
 * gerar cada etapa — e o mecanismo tecnico do reaproveitamento composto
 * (cliente 2 reaproveita ~30% do cliente 1, cliente 6 reaproveita ~90%).
 *
 * Sem GEMINI_API_KEY configurada, ou se a chamada de embedding falhar,
 * a gravacao/recall nunca lanca — no pior caso, cai pra so mostrar as
 * notas mais recentes do nicho sem ranking semantico.
 */
import { GeminiEmbeddingsProvider, cosineSimilarity, type EmbeddingsProvider } from "@operaia/ai-core";
import { prisma } from "@operaia/database";
import type { MarketingStageId } from "./marketing-office.types.js";

const TOP_K = 3;
const MAX_CANDIDATES = 20;
const MAX_CONTENT_CHARS = 2500;

export interface NicheMemoryHit {
  readonly stage: MarketingStageId;
  readonly content: string;
  readonly score: number;
}

let cachedEmbeddings: EmbeddingsProvider | undefined;
let cachedForKey: string | undefined;

function getEmbeddings(apiKey: string | undefined): EmbeddingsProvider | undefined {
  if (!apiKey) return undefined;
  if (!cachedEmbeddings || cachedForKey !== apiKey) {
    cachedEmbeddings = new GeminiEmbeddingsProvider({ apiKey });
    cachedForKey = apiKey;
  }
  return cachedEmbeddings;
}

export interface RecordNicheMemoryParams {
  readonly nicheId: string;
  readonly campaignId: string;
  readonly stage: MarketingStageId;
  readonly content: string;
  readonly embeddingsApiKey: string | undefined;
}

/** Grava (ou atualiza) a nota desta etapa desta campanha na memoria do nicho. */
export async function recordNicheMemory(params: RecordNicheMemoryParams): Promise<void> {
  const content = params.content.slice(0, MAX_CONTENT_CHARS);
  const embeddings = getEmbeddings(params.embeddingsApiKey);
  const embedding = embeddings ? ((await embeddings.embed(content)) ?? []) : [];

  await prisma.nicheMemoryNote.upsert({
    where: {
      nicheId_campaignId_stage: {
        nicheId: params.nicheId,
        campaignId: params.campaignId,
        stage: params.stage,
      },
    },
    create: {
      nicheId: params.nicheId,
      campaignId: params.campaignId,
      stage: params.stage,
      content,
      embedding: [...embedding],
    },
    update: { content, embedding: [...embedding] },
  });
}

export interface RecallNicheMemoryParams {
  readonly nicheId: string;
  readonly stage: MarketingStageId;
  readonly queryText: string;
  readonly excludeCampaignId: string;
  readonly embeddingsApiKey: string | undefined;
}

/** Busca as notas mais relevantes desta etapa, deste nicho, de OUTRAS campanhas. */
export async function recallNicheMemory(
  params: RecallNicheMemoryParams,
): Promise<readonly NicheMemoryHit[]> {
  const rows = await prisma.nicheMemoryNote.findMany({
    where: {
      nicheId: params.nicheId,
      stage: params.stage,
      campaignId: { not: params.excludeCampaignId },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
  });
  if (rows.length === 0) return [];

  const embeddings = getEmbeddings(params.embeddingsApiKey);
  const queryEmbedding = embeddings ? await embeddings.embed(params.queryText) : null;

  if (!queryEmbedding) {
    // Sem embedding disponivel: melhor sinal que sobra e recencia dentro do nicho.
    return rows.slice(0, TOP_K).map((row) => ({
      stage: row.stage as MarketingStageId,
      content: row.content,
      score: 0,
    }));
  }

  return rows
    .map((row) => ({
      stage: row.stage as MarketingStageId,
      content: row.content,
      score: row.embedding.length > 0 ? cosineSimilarity(queryEmbedding, row.embedding) : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}
