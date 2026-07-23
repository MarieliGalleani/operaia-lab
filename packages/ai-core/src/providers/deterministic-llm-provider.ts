import type {
  LLMCompletion,
  LLMMessage,
  LLMProvider,
} from "../llm-provider.js";

/**
 * Provider deterministico — APENAS para testes automatizados.
 * Nao usa rede; devolve narrativa fixa conforme o prompt.
 */
export class DeterministicLLMProvider implements LLMProvider {
  readonly name = "deterministic";

  async complete(messages: readonly LLMMessage[]): Promise<LLMCompletion> {
    const user =
      messages.find((message) => message.role === "user")?.content ?? "";
    const content =
      user.includes("Modo: consolidacao") || user.includes("consolidacao apos")
        ? "Consolidei as entregas da equipe, priorizei o que destrava o objetivo e preparei as proximas acoes para voce."
        : "Analisei o workspace, priorizei as pendencias e preparei o plano de coordenacao com a equipe.";
    return { content, model: "deterministic" };
  }
}

/** Alias legado usado em testes anteriores. */
export { DeterministicLLMProvider as DeterministicNarrativeLLM };
