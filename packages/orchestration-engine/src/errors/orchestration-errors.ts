/** Erros do Orchestration Engine. */
export abstract class OrchestrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Erro irrecuperavel: interrompe o loop imediatamente (nao conta como simples
 * falha de ciclo). Adapters de porta podem lancar isto para sinalizar algo fatal.
 */
export class FatalOrchestrationError extends OrchestrationError {}
