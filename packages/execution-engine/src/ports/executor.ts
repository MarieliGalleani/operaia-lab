import type { Action, ActionOutput } from "../execution/action.js";
import type { ExecutionContext } from "../execution/execution-context.js";

/**
 * Contrato de um executor de acao.
 *
 * Cada executor e responsavel por UM tipo de acao. O Engine descobre o
 * executor correto perguntando `supports(action)` — nunca com um switch.
 */
export interface ActionExecutor {
  readonly name: string;
  supports(action: Action): boolean;
  execute(
    action: Action,
    context: ExecutionContext,
  ): Promise<ActionOutput> | ActionOutput;
}
