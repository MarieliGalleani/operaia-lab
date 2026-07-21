/** Erros do Execution Engine. Independentes de infraestrutura e de vendors. */
export abstract class ExecutionEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Plano estruturalmente invalido (sem acoes, id ausente, id duplicado, etc.). */
export class InvalidExecutionPlanError extends ExecutionEngineError {}

/** Nenhum executor registrado suporta o tipo da acao. */
export class ExecutorNotFoundError extends ExecutionEngineError {
  constructor(actionType: string, actionId: string) {
    super(
      `Nenhum executor encontrado para a acao ${actionId} (tipo: ${actionType}).`,
    );
  }
}
