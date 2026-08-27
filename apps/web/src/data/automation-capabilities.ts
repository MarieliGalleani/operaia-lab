/**
 * Capacidades conhecidas pela experiência atual, mas ainda sem registro
 * operacional confirmado no backend.
 *
 * Estes itens não executam nada e não representam automações persistidas.
 * Servem para explicar ao usuário o que está sendo preparado pelo escritório.
 */
export interface PreparationAutomation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly whenToUse: string;
  readonly proposedActions: readonly string[];
}

export const PREPARATION_AUTOMATIONS: readonly PreparationAutomation[] = [
  {
    id: "onboarding-novos-clientes",
    name: "Onboarding novos clientes",
    description:
      "Capacidade em preparação para automatizar o onboarding de novos clientes.",
    whenToUse: "Quando um novo lead entrar pelo formulário.",
    proposedActions: ["Validar dados", "Atualizar CRM", "Notificar equipe"],
  },
  {
    id: "follow-up-leads-inativos",
    name: "Follow-up leads inativos",
    description:
      "Capacidade em preparação para recuperar leads sem resposta em 7 dias.",
    whenToUse: "Em uma agenda diária de acompanhamento.",
    proposedActions: ["Validar dados", "Atualizar CRM", "Notificar equipe"],
  },
];
