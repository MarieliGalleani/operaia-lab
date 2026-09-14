/**
 * Cerebro do Nicho (P1.X Fase 2, generalizado na Fase 6) — memoria vetorial
 * cross-cliente, compartilhada por QUALQUER andar com pipeline por cliente
 * (Marketing/Mercurio, Automacao/Atlas, e o que vier depois).
 *
 * Cada etapa bem-sucedida (conteudo real, nao fallback) de um pipeline
 * vira uma nota aqui, escopada por (nicheId, office). Trabalhos futuros do
 * MESMO nicho E do MESMO office recuperam as notas mais relevantes (por
 * similaridade de cosseno, mesmo padrao de OperationalMemoryNote) e
 * recebem esse conteudo como contexto antes de gerar cada etapa — e o
 * mecanismo tecnico do reaproveitamento composto (cliente 2 reaproveita
 * ~30% do cliente 1, cliente 6 reaproveita ~90%).
 *
 * "office" existe pra nao misturar, por exemplo, o Diagnostico do
 * Marketing com o Diagnostico da Automacao — mesmo nome de etapa,
 * conteudo com objetivo bem diferente.
 *
 * Sem GEMINI_API_KEY configurada, ou se a chamada de embedding falhar,
 * a gravacao/recall nunca lanca — no pior caso, cai pra so mostrar as
 * notas mais recentes do nicho sem ranking semantico.
 */
import { GeminiEmbeddingsProvider, cosineSimilarity, type EmbeddingsProvider } from "@operaia/ai-core";
import { prisma } from "@operaia/database";

const TOP_K = 3;
const MAX_CANDIDATES = 20;
const MAX_CONTENT_CHARS = 2500;

export interface NicheMemoryHit {
  readonly stage: string;
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
  readonly office: string;
  readonly sourceId: string;
  readonly stage: string;
  readonly content: string;
  readonly embeddingsApiKey: string | undefined;
}

/** Grava (ou atualiza) a nota desta etapa deste trabalho na memoria do nicho. */
export async function recordNicheMemory(params: RecordNicheMemoryParams): Promise<void> {
  const content = params.content.slice(0, MAX_CONTENT_CHARS);
  const embeddings = getEmbeddings(params.embeddingsApiKey);
  const embedding = embeddings ? ((await embeddings.embed(content)) ?? []) : [];

  await prisma.nicheMemoryNote.upsert({
    where: {
      nicheId_office_sourceId_stage: {
        nicheId: params.nicheId,
        office: params.office,
        sourceId: params.sourceId,
        stage: params.stage,
      },
    },
    create: {
      nicheId: params.nicheId,
      office: params.office,
      sourceId: params.sourceId,
      stage: params.stage,
      content,
      embedding: [...embedding],
    },
    update: { content, embedding: [...embedding] },
  });
}

export interface RecallNicheMemoryParams {
  readonly nicheId: string;
  readonly office: string;
  readonly stage: string;
  readonly queryText: string;
  readonly excludeSourceId: string;
  readonly embeddingsApiKey: string | undefined;
}

/** Busca as notas mais relevantes desta etapa, deste nicho, deste office, de OUTROS trabalhos. */
export async function recallNicheMemory(
  params: RecallNicheMemoryParams,
): Promise<readonly NicheMemoryHit[]> {
  const rows = await prisma.nicheMemoryNote.findMany({
    where: {
      nicheId: params.nicheId,
      office: params.office,
      stage: params.stage,
      sourceId: { not: params.excludeSourceId },
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
      stage: row.stage,
      content: row.content,
      score: 0,
    }));
  }

  return rows
    .map((row) => ({
      stage: row.stage,
      content: row.content,
      score: row.embedding.length > 0 ? cosineSimilarity(queryEmbedding, row.embedding) : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}
