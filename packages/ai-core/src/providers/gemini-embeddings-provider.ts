import { GoogleGenAI } from "@google/genai";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-004";

export interface GeminiEmbeddingsProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
}

export interface EmbeddingsProvider {
  /** null = falha (chave ausente, rede, etc.) — nunca lanca, quem chama decide o fallback. */
  embed(text: string): Promise<readonly number[] | null>;
}

/**
 * Embeddings via Gemini (text-embedding-004, 768 dims) — mesma chave
 * ja usada pro GeminiProvider de completions, sem credencial nova.
 * Falha nunca lanca: quem usa isso (busca semantica de memoria) cai
 * pra lexical em vez de quebrar a missao em execucao.
 */
export class GeminiEmbeddingsProvider implements EmbeddingsProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(options: GeminiEmbeddingsProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("GeminiEmbeddingsProvider: apiKey e obrigatoria.");
    }
    this.client = new GoogleGenAI({ apiKey: options.apiKey });
    this.model = options.model?.trim() || DEFAULT_EMBEDDING_MODEL;
  }

  async embed(text: string): Promise<readonly number[] | null> {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const response = await this.client.models.embedContent({
        model: this.model,
        contents: [trimmed],
      });
      return response.embeddings?.[0]?.values ?? null;
    } catch {
      return null;
    }
  }
}

/** Similaridade de cosseno — 1 = identico, 0 = ortogonal, -1 = oposto. */
export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
