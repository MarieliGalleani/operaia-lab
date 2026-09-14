/** Cliente tipado do pipeline de Automação por cliente (Atlas) — sem mock. */
import { createHttpClient } from "./http-client";

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

export interface AutomationEngagement {
  readonly id: string;
  readonly niche: string;
  readonly nicheId: string;
  readonly briefing: string;
  readonly status: "PENDING" | "RUNNING" | "DONE" | "ERROR";
  readonly currentStage: AutomationStageId | null;
  readonly diagnostico: string | null;
  readonly mapaProcessos: string | null;
  readonly automacoesRecomendadas: string | null;
  readonly arquiteturaIntegracao: string | null;
  readonly planoImplementacao: string | null;
  readonly playbookOperacional: string | null;
  readonly frameworkMonitoramento: string | null;
  readonly attachmentName: string | null;
  readonly attachmentMimeType: string | null;
  readonly errorMessage: string | null;
  readonly fallbackStages: readonly AutomationStageId[];
  readonly clientName: string | null;
  readonly totalDurationMs: number | null;
  readonly reuseRatio: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AutomationAttachment {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

export interface CreateEngagementInput {
  readonly niche: string;
  readonly briefing: string;
  readonly clientName?: string;
  readonly attachmentName?: string;
  readonly attachmentMimeType?: string;
  readonly attachmentBase64?: string;
}

export interface AutomationEngagementsClient {
  listEngagements(): Promise<readonly AutomationEngagement[]>;
  createEngagement(input: CreateEngagementInput): Promise<AutomationEngagement>;
  getEngagement(id: string): Promise<AutomationEngagement>;
  getAttachment(id: string): Promise<AutomationAttachment>;
}

export function createAutomationEngagementsClient(): AutomationEngagementsClient {
  const http = createHttpClient();
  return {
    async listEngagements() {
      return http.get<readonly AutomationEngagement[]>("/office/automation-engagements");
    },
    async createEngagement(input) {
      return http.post<AutomationEngagement>("/office/automation-engagements", input);
    },
    async getEngagement(id) {
      return http.get<AutomationEngagement>(`/office/automation-engagements/${id}`);
    },
    async getAttachment(id) {
      return http.get<AutomationAttachment>(`/office/automation-engagements/${id}/attachment`);
    },
  };
}
