import type { Action } from "../execution/action.js";
import type { ActionExecutor } from "../ports/executor.js";

/**
 * Localiza o executor correto para uma acao.
 * O Engine consulta o registry e nunca conhece implementacoes concretas.
 */
export class ExecutorRegistry {
  private readonly executors: ActionExecutor[] = [];

  register(executor: ActionExecutor): this {
    this.executors.push(executor);
    return this;
  }

  /** Retorna o primeiro executor que suporta a acao, ou `undefined`. */
  resolve(action: Action): ActionExecutor | undefined {
    return this.executors.find((executor) => executor.supports(action));
  }

  all(): readonly ActionExecutor[] {
    return [...this.executors];
  }
}
