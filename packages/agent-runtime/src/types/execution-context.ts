import type { AgentDefinition } from "@operaia/agents";
import type { MemorySearchResult } from "@operaia/memory";
import type { Tool } from "./tool.js";

/** Entrada de uma execucao do runtime. */
export interface RuntimeInput {
  readonly agentKey: string;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** Quantidade maxima de registros de memoria a recuperar. */
  readonly memoryTopK?: number;
}

/**
 * Contexto imutavel montado pelo runtime e compartilhado entre os estagios
 * (prompt builder, selecao de LLM, geracao de plano).
 */
export interface ExecutionContext {
  readonly agent: AgentDefinition;
  readonly input: RuntimeInput;
  readonly memory: readonly MemorySearchResult[];
  readonly tools: readonly Tool[];
  readonly startedAt: Date;
}
