/**
 * Workspace representa um projeto vivo (ex.: NEXO, MenuFlow, Plataforma).
 * Todo agente sempre trabalha DENTRO de um Workspace, nunca sobre um prompt solto.
 *
 * Aspectos ricos (memoria, documentacao, tarefas) sao providos por outras
 * camadas (memory, modulos de projeto/tarefa) e nao sao duplicados aqui.
 */
export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
