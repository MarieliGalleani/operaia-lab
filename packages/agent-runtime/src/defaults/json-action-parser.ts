import type { LLMCompletion } from "@operaia/ai-core";
import type { ActionParser } from "../ports/action-parser.js";
import type { AgentAction } from "../types/action.js";

const JSON_FENCE = /```json\s*([\s\S]*?)```/i;

/**
 * Extrai acoes de um bloco JSON na resposta do modelo.
 *
 * Formatos aceitos:
 *   { "actions": [ { "type": "...", "payload": { ... } } ] }
 *   [ { "type": "...", "payload": { ... } } ]
 *
 * Entradas malformadas sao ignoradas (nunca lanca).
 */
export class JsonActionParser implements ActionParser {
  parse(completion: LLMCompletion): readonly AgentAction[] {
    const raw = this.extractJson(completion.content);
    if (raw === null) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    const candidates = this.toCandidateList(parsed);
    return candidates.filter(isAgentAction);
  }

  private extractJson(content: string): string | null {
    const fenced = JSON_FENCE.exec(content);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }
    const trimmed = content.trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[") ? trimmed : null;
  }

  private toCandidateList(parsed: unknown): unknown[] {
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (isRecord(parsed) && Array.isArray(parsed["actions"])) {
      return parsed["actions"];
    }
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAgentAction(value: unknown): value is AgentAction {
  return (
    isRecord(value) &&
    typeof value["type"] === "string" &&
    isRecord(value["payload"])
  );
}
