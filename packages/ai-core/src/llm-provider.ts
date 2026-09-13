/**
 * Contrato de abstracao para provedores de LLM.
 *
 * O CORE nao conhece nenhum provedor concreto (OpenAI, Anthropic, etc.).
 * Integrar um provedor real no futuro = implementar esta interface,
 * sem tocar no dominio nem nos agentes.
 */

export type LLMRole = "system" | "user" | "assistant";

export interface LLMImageAttachment {
  readonly mimeType: string;
  /** Base64 puro, sem prefixo data: URI. */
  readonly base64: string;
}

export interface LLMMessage {
  readonly role: LLMRole;
  readonly content: string;
  /** Anexos de imagem (multimodal) — providers sem suporte os ignoram. */
  readonly images?: readonly LLMImageAttachment[];
}

export interface LLMCompletionOptions {
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface LLMCompletion {
  readonly content: string;
  readonly model: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
  };
}

export interface LLMProvider {
  readonly name: string;
  complete(
    messages: readonly LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletion>;
}
