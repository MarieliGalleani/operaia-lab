/**
 * Metadado de uma ferramenta disponivel para um agente.
 * O runtime apenas DESCOBRE e ANUNCIA ferramentas no prompt; a execucao
 * concreta e responsabilidade de camadas superiores (ex.: ActionExecutor).
 */
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: Readonly<Record<string, unknown>>;
}
