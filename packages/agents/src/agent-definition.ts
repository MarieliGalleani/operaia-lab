/**
 * Definicao declarativa de um agente.
 *
 * A definicao vive em codigo (versionavel, revisavel) e e materializada no
 * banco via seed. Em runtime, o agente sera montado combinando esta definicao
 * com um LLMProvider (@operaia/ai-core) e um MemoryStore (@operaia/memory).
 */
export interface AgentDefinition {
  /** Identificador estavel usado para seed idempotente e referencia interna. */
  readonly key: string;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly systemInstructions: string;
  readonly active: boolean;
}
