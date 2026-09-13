import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMCompletion,
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
} from "../llm-provider.js";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 4096;

export interface AnthropicProviderOptions {
  readonly apiKey: string;
  readonly model?: string;
}

/**
 * Segunda implementacao concreta de LLMProvider (Anthropic Claude).
 * Mesmo contrato do GeminiProvider — Employees/Orchestrator nao sabem
 * qual provedor esta por tras, so recebem LLMProvider.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly defaultModel: string;

  constructor(options: AnthropicProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("AnthropicProvider: apiKey e obrigatoria.");
    }
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.defaultModel = options.model?.trim() || DEFAULT_ANTHROPIC_MODEL;
  }

  async complete(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion> {
    const model = options?.model?.trim() || this.defaultModel;
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature,
      system: system || undefined,
      messages: conversation,
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!content) {
      throw new Error("AnthropicProvider: resposta vazia do modelo.");
    }

    return {
      content,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      },
    };
  }
}
