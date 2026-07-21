/**
 * Formato PADRAO de saida de qualquer funcionario (ResponsePolicy).
 * Resumo | Analise | Plano | Recomendacoes | Riscos | Proximas acoes.
 */
export interface EmployeeReport {
  readonly summary: string;
  readonly analysis: string;
  readonly plan: readonly string[];
  readonly recommendations: readonly string[];
  readonly risks: readonly string[];
  readonly nextActions: readonly string[];
}
