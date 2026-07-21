import type { Workspace } from "./workspace.js";

/**
 * Contexto montado ao abrir uma sessao: o workspace, o objetivo e metadados
 * derivados que serao propagados a orquestracao.
 */
export interface WorkspaceContext {
  readonly workspace: Workspace;
  readonly objective: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
