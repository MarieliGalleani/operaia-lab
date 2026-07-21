import { agentRegistry, type AgentDefinition } from "@operaia/agents";
import type { AgentLoader } from "../ports/agent-loader.js";

/** Carrega agentes a partir do registro estatico de @operaia/agents. */
export class RegistryAgentLoader implements AgentLoader {
  load(agentKey: string): AgentDefinition | null {
    return agentRegistry.findByKey(agentKey) ?? null;
  }
}
