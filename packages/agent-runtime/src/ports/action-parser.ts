import type { LLMCompletion } from "@operaia/ai-core";
import type { AgentAction } from "../types/action.js";

/** Extrai acoes propostas a partir da resposta bruta do modelo. */
export interface ActionParser {
  parse(completion: LLMCompletion): readonly AgentAction[];
}
