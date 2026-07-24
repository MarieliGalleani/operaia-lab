import type { Action } from "../execution/action.js";
import type { ActionExecutor } from "../ports/executor.js";
import { ExecutorRegistry } from "../executors/registry.js";

/**
 * Registry oficial de Actions por tipo.
 *
 * Cada tipo e associado a um ActionExecutor. O Engine resolve via este
 * catalogo — sem switch no nucleo.
 *
 * Alias conceitual do "Action Registry" da Equipe Digital; internamente
 * reutiliza ExecutorRegistry.
 */
export class ActionRegistry {
  private readonly types = new Map<string, ActionExecutor>();
  private readonly executors = new ExecutorRegistry();

  register(type: string, executor: ActionExecutor): this {
    this.types.set(type, executor);
    this.executors.register(typedExecutor(type, executor));
    return this;
  }

  /** Tipos registrados (catalogo). */
  registeredTypes(): readonly string[] {
    return [...this.types.keys()];
  }

  has(type: string): boolean {
    return this.types.has(type);
  }

  resolve(action: Action): ActionExecutor | undefined {
    return this.executors.resolve(action);
  }

  /** Vista compatível com ExecutionEngine (ExecutorRegistry). */
  toExecutorRegistry(): ExecutorRegistry {
    return this.executors;
  }
}

/**
 * Garante que o executor so atende o tipo registrado no catalogo,
 * mesmo se o executor interno for mais amplo.
 */
function typedExecutor(type: string, executor: ActionExecutor): ActionExecutor {
  return {
    name: executor.name,
    supports(action: Action): boolean {
      return action.type === type && executor.supports(action);
    },
    execute(action, context) {
      return executor.execute(action, context);
    },
  };
}
