/**
 * Acao proposta pelo agente (ex.: "create_task").
 * O kernel apenas PROPOE acoes; nao as executa. Isso mantem a execucao
 * autonoma como uma extensao opcional construida ao redor do runtime.
 */
export interface AgentAction {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
