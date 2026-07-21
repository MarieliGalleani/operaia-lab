import type { LLMMessage } from "@operaia/ai-core";
import type { MemorySearchResult } from "@operaia/memory";
import type { PromptBuilder } from "../ports/prompt-builder.js";
import type { ExecutionContext } from "../types/execution-context.js";
import type { Tool } from "../types/tool.js";

/**
 * Monta o prompt em camadas de mensagens de sistema:
 * instrucoes do agente -> ferramentas -> memoria -> mensagem do usuario.
 */
export class DefaultPromptBuilder implements PromptBuilder {
  build(context: ExecutionContext): readonly LLMMessage[] {
    const messages: LLMMessage[] = [
      { role: "system", content: context.agent.systemInstructions },
    ];

    if (context.tools.length > 0) {
      messages.push({ role: "system", content: renderTools(context.tools) });
    }

    if (context.memory.length > 0) {
      messages.push({ role: "system", content: renderMemory(context.memory) });
    }

    messages.push({ role: "user", content: context.input.message });
    return messages;
  }
}

function renderTools(tools: readonly Tool[]): string {
  const lines = tools.map((tool) => `- ${tool.name}: ${tool.description}`);
  return ["Ferramentas disponiveis:", ...lines].join("\n");
}

function renderMemory(memory: readonly MemorySearchResult[]): string {
  const lines = memory.map(
    (result, index) =>
      `[${index + 1}] (score ${result.score.toFixed(3)}) ${result.record.content}`,
  );
  return ["Contexto recuperado da memoria:", ...lines].join("\n");
}
