import type { LLMMessage } from "../llm-provider.js";

/** Conteudo no formato esperado pelo Google Gen AI SDK. */
export interface GeminiContent {
  readonly role: "user" | "model";
  readonly parts: readonly { readonly text: string }[];
}

export interface GeminiRequestParts {
  readonly systemInstruction: string | undefined;
  readonly contents: readonly GeminiContent[];
}

/**
 * Traduz LLMMessage[] (contrato OperaIA) → payload Gemini.
 * Sem regra de negocio — apenas adaptacao de protocolo.
 */
export function toGeminiRequestParts(
  messages: readonly LLMMessage[],
): GeminiRequestParts {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim() || undefined;

  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      continue;
    }
    const role = message.role === "assistant" ? "model" : "user";
    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      const merged = `${previous.parts[0]?.text ?? ""}\n\n${message.content}`;
      contents[contents.length - 1] = {
        role,
        parts: [{ text: merged }],
      };
      continue;
    }
    contents.push({ role, parts: [{ text: message.content }] });
  }

  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "" }] });
  }

  if (contents[0]?.role === "model") {
    contents.unshift({
      role: "user",
      parts: [{ text: "(contexto)" }],
    });
  }

  return { systemInstruction, contents };
}
