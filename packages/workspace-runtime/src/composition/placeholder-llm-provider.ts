import type {
  LLMCompletion,
  LLMMessage,
  LLMProvider,
} from "@operaia/ai-core";

/**
 * Provedor LLM placeholder. Deterministico, sem chamadas externas.
 *
 * Existe apenas para fechar o circuito operacional enquanto nao ha integracao
 * real de LLM. E substituido por um provedor real (OpenAI/Anthropic/etc.) via
 * injecao de dependencias no Composition Root. NAO produz dados de negocio.
 */
export class PlaceholderLLMProvider implements LLMProvider {
  readonly name = "placeholder";

  async complete(messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    const last = messages.at(-1);
    return {
      content: `[placeholder] ${last?.content ?? ""}`,
      model: "placeholder",
    };
  }
}
