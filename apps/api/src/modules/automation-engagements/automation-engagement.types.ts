import type { AutomationEngagement as PrismaAutomationEngagement } from "@operaia/database";

export type AutomationStageId =
  | "DIAGNOSTICO"
  | "MAPA_PROCESSOS"
  | "AUTOMACOES_RECOMENDADAS"
  | "ARQUITETURA_INTEGRACAO"
  | "PLANO_IMPLEMENTACAO"
  | "PLAYBOOK_OPERACIONAL"
  | "FRAMEWORK_MONITORAMENTO";

export const AUTOMATION_STAGE_ORDER: readonly AutomationStageId[] = [
  "DIAGNOSTICO",
  "MAPA_PROCESSOS",
  "AUTOMACOES_RECOMENDADAS",
  "ARQUITETURA_INTEGRACAO",
  "PLANO_IMPLEMENTACAO",
  "PLAYBOOK_OPERACIONAL",
  "FRAMEWORK_MONITORAMENTO",
];

export const AUTOMATION_STAGE_LABEL: Readonly<Record<AutomationStageId, string>> = {
  DIAGNOSTICO: "Diagnóstico Inicial",
  MAPA_PROCESSOS: "Mapa de Processos",
  AUTOMACOES_RECOMENDADAS: "Automações Recomendadas",
  ARQUITETURA_INTEGRACAO: "Arquitetura de Integração",
  PLANO_IMPLEMENTACAO: "Plano de Implementação",
  PLAYBOOK_OPERACIONAL: "Playbook Operacional",
  FRAMEWORK_MONITORAMENTO: "Framework de Monitoramento",
};

export const AUTOMATION_STAGE_FIELD: Readonly<
  Record<AutomationStageId, keyof PrismaAutomationEngagement>
> = {
  DIAGNOSTICO: "diagnostico",
  MAPA_PROCESSOS: "mapaProcessos",
  AUTOMACOES_RECOMENDADAS: "automacoesRecomendadas",
  ARQUITETURA_INTEGRACAO: "arquiteturaIntegracao",
  PLANO_IMPLEMENTACAO: "planoImplementacao",
  PLAYBOOK_OPERACIONAL: "playbookOperacional",
  FRAMEWORK_MONITORAMENTO: "frameworkMonitoramento",
};

export type AutomationEngagement = PrismaAutomationEngagement;
