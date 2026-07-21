/** Erros do runtime. Nao dependem do dominio HTTP nem de infraestrutura. */
export abstract class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class AgentNotFoundError extends RuntimeError {
  constructor(agentKey: string) {
    super(`Agente nao encontrado: ${agentKey}`);
  }
}

export class InactiveAgentError extends RuntimeError {
  constructor(agentKey: string) {
    super(`Agente inativo: ${agentKey}`);
  }
}
