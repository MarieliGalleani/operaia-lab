import type { AgentDefinition } from "@operaia/agents";

/** Carrega a definicao de um agente pela sua chave estavel. */
export interface AgentLoader {
  load(agentKey: string): Promise<AgentDefinition | null> | AgentDefinition | null;
}
