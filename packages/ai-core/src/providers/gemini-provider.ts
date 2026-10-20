import { GoogleGenAI } from "@google/genai";
import type {
  LLMCompletion,
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
} from "../llm-provider.js";
import { toGeminiRequestParts } from "./gemini-message-adapter.js";

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export interface GeminiProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
  /** Esperas entre novas tentativas em erro passageiro (503/429). */
  readonly retryDelaysMs?: readonly number[];
}

/**
 * Primeira implementacao concreta de LLMProvider (Google Gemini).
 * Nao contem regras de negocio — so completa prompts via Gen AI SDK.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;
  private readonly defaultModel: string;
  private readonly retryDelaysMs: readonly number[];

  constructor(options: GeminiProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("GeminiProvider: apiKey e obrigatoria.");
    }
    this.client = new GoogleGenAI({ apiKey: options.apiKey });
    this.defaultModel = options.model?.trim() || DEFAULT_GEMINI_MODEL;
    this.retryDelaysMs = options.retryDelaysMs ?? [2_000, 5_000];
  }

  async complete(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion> {
    const model = options?.model?.trim() || this.defaultModel;
    const { systemInstruction, contents } = toGeminiRequestParts(messages);

    const geminiContents = contents.map((content) => ({
      role: content.role,
      parts: content.parts.map((part) =>
        "inlineData" in part
          ? { inlineData: part.inlineData }
          : { text: part.text },
      ),
    }));
    
    const request = {
      model,
      contents: geminiContents,
      config: {
        systemInstruction,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      },
    };
    // 503 "high demand" e 429 sao passageiros: antes um unico pico do Google
    // derrubava a missao direto para o texto deterministico.
    let response: Awaited<ReturnType<typeof this.client.models.generateContent>>;
    for (let attempt = 0; ; attempt += 1) {
      try {
        response = await this.client.models.generateContent(request);
        break;
      } catch (error) {
        const delay = this.retryDelaysMs[attempt];
        if (delay === undefined || !isTransientGeminiError(error)) throw error;
        await sleep(delay);
      }
    }
    
    const content = response.text?.trim() ?? "";
    if (!content) {
      throw new Error("GeminiProvider: resposta vazia do modelo.");
    }

    const usageMeta = response.usageMetadata;
    return {
      content,
      model,
      usage: usageMeta
        ? {
            promptTokens: usageMeta.promptTokenCount ?? 0,
            completionTokens: usageMeta.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 503 (UNAVAILABLE / high demand) e 429 (RESOURCE_EXHAUSTED) valem nova tentativa. */
export function isTransientGeminiError(error: unknown): boolean {
  const e = error as { status?: unknown; code?: unknown; message?: unknown } | null;
  const status = Number(e?.status ?? e?.code);
  if (status === 503 || status === 429) return true;
  const message = String(e?.message ?? "");
  return /\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(message);
}
