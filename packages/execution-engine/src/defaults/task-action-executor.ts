import { ActionType, type Action, type ActionOutput } from "../execution/action.js";
import { BaseActionExecutor } from "../executors/action-executor.js";

/**
 * Executor default para CREATE_TASK.
 *
 * Nesta sprint o Engine e generico e nao integra com banco/servicos reais:
 * este executor apenas ACUSA a acao, devolvendo um output estruturado.
 * A criacao real de tarefa virara via Tool Connectors, sem alterar o Engine.
 */
export class TaskActionExecutor extends BaseActionExecutor {
  readonly name = "task.create";
  protected readonly type = ActionType.CREATE_TASK;

  execute(action: Action): ActionOutput {
    return {
      acknowledged: true,
      type: action.type,
      payload: action.payload,
    };
  }
}
