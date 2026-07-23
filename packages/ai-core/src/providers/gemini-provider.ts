import { GoogleGenAI } from "@google/genai";
import type {
  LLMCompletion,
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
} from "../llm-provider.js";
import { toGeminiRequestParts } from "./gemini-message-adapter.js";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export interface GeminiProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
}

/**
 * Primeira implementacao concreta de LLMProvider (Google Gemini).
 * Nao contem regras de negocio — so completa prompts via Gen AI SDK.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;
  private readonly defaultModel: string;

  constructor(options: GeminiProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("GeminiProvider: apiKey e obrigatoria.");
    }
    this.client = new GoogleGenAI({ apiKey: options.apiKey });
    this.defaultModel = options.model?.trim() || DEFAULT_GEMINI_MODEL;
  }

  async complete(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion> {
    const model = options?.model?.trim() || this.defaultModel;
    const { systemInstruction, contents } = toGeminiRequestParts(messages);

    const response = await this.client.models.generateContent({
      model,
      contents: [...contents],
      config: {
        systemInstruction,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      },
    });

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
