import { ActionType, type ActionOutput } from "../execution/action.js";
import { BaseActionExecutor } from "../executors/action-executor.js";

/**
 * Executor que nao produz efeito colateral. Util para acoes LOG e como
 * placeholder de tipos ainda sem executor real. O tipo suportado e configuravel.
 */
export class NoopExecutor extends BaseActionExecutor {
  readonly name = "noop";
  protected readonly type: string;

  constructor(type: string = ActionType.LOG) {
    super();
    this.type = type;
  }

  execute(): ActionOutput {
    return {};
  }
}
