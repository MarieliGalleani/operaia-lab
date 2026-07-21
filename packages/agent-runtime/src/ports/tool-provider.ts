import type { AgentDefinition } from "@operaia/agents";
import type { RuntimeInput } from "../types/execution-context.js";
import type { Tool } from "../types/tool.js";

export interface ToolDiscoveryContext {
  readonly agent: AgentDefinition;
  readonly input: RuntimeInput;
}

/** Descobre as ferramentas disponiveis para um agente numa dada execucao. */
export interface ToolProvider {
  discover(
    context: ToolDiscoveryContext,
  ): Promise<readonly Tool[]> | readonly Tool[];
}
