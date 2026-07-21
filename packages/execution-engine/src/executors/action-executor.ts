import type { Action, ActionOutput } from "../execution/action.js";
import type { ExecutionContext } from "../execution/execution-context.js";
import type { ActionExecutor } from "../ports/executor.js";

/**
 * Base para executores que atendem um unico tipo de acao.
 * Implementa `supports` por comparacao de tipo, reduzindo boilerplate e
 * mantendo o Open/Closed: um novo executor apenas define `type` e `execute`.
 */
export abstract class BaseActionExecutor implements ActionExecutor {
  abstract readonly name: string;
  protected abstract readonly type: string;

  supports(action: Action): boolean {
    return action.type === this.type;
  }

  abstract execute(
    action: Action,
    context: ExecutionContext,
  ): Promise<ActionOutput> | ActionOutput;
}
