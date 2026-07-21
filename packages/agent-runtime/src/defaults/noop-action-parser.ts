import type { ActionParser } from "../ports/action-parser.js";
import type { AgentAction } from "../types/action.js";

/** Parser padrao que nao extrai acoes. Seguro por default. */
export class NoopActionParser implements ActionParser {
  parse(): readonly AgentAction[] {
    return [];
  }
}
