import type { AgentDefinition } from "./agent-definition.js";
import { operaiaCeo } from "./definitions/operaia-ceo.js";

/**
 * Registro central de definicoes de agentes.
 * Novos agentes especialistas serao adicionados aqui.
 */
const definitions: readonly AgentDefinition[] = [operaiaCeo];

export const agentRegistry = {
  all(): readonly AgentDefinition[] {
    return definitions;
  },
  findByKey(key: string): AgentDefinition | undefined {
    return definitions.find((definition) => definition.key === key);
  },
} as const;
