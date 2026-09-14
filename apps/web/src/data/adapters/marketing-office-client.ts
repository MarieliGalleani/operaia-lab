/** Cliente tipado do Marketing Office (andar de Marketing) — Mercurio real, sem mock. */
import { createHttpClient } from "./http-client";

export type MarketingStageId =
  | "DIAGNOSTICO"
  | "MAPA_NICHO"
  | "CRIATIVOS"
  | "LANDING_PAGE"
  | "PITCH_DECK"
  | "PLANO_GTM"
  | "PLAYBOOK_VENDAS"
  | "VIDEO_ROTEIRO"
  | "PLANO_TRAFEGO"
  | "FRAMEWORK_PERFORMANCE";

export const MARKETING_STAGE_ORDER: readonly MarketingStageId[] = [
  "DIAGNOSTICO",
  "MAPA_NICHO",
  "CRIATIVOS",
  "LANDING_PAGE",
  "PITCH_DECK",
  "PLANO_GTM",
  "PLAYBOOK_VENDAS",
  "VIDEO_ROTEIRO",
  "PLANO_TRAFEGO",
  "FRAMEWORK_PERFORMANCE",
];

export const MARKETING_STAGE_LABEL: Readonly<Record<MarketingStageId, string>> = {
  DIAGNOSTICO: "Diagnóstico Inicial",
  MAPA_NICHO: "Mapa de Nicho",
  CRIATIVOS: "Criativos",
  LANDING_PAGE: "Landing Page",
  PITCH_DECK: "Pitch Deck",
  PLANO_GTM: "Plano de GTM",
  PLAYBOOK_VENDAS: "Playbook de Vendas",
  VIDEO_ROTEIRO: "Roteiro de Vídeo",
  PLANO_TRAFEGO: "Plano de Tráfego Pago",
  FRAMEWORK_PERFORMANCE: "Framework de Performance",
};

export interface MarketingCampaign {
  readonly id: string;
  readonly niche: string;
  readonly nicheId: string;
  readonly briefing: string;
  readonly status: "PENDING" | "RUNNING" | "DONE" | "ERROR";
  readonly currentStage: MarketingStageId | null;
  readonly diagnostico: string | null;
  readonly nicheMap: string | null;
  readonly creatives: string | null;
  readonly landingPageHtml: string | null;
  readonly pitchDeck: string | null;
  readonly gtmPlan: string | null;
  readonly salesPlaybook: string | null;
  readonly videoRoteiro: string | null;
  readonly planoTrafego: string | null;
  readonly frameworkPerformance: string | null;
  readonly attachmentName: string | null;
  readonly attachmentMimeType: string | null;
  readonly errorMessage: string | null;
  /** Etapas cujo conteudo veio do fallback (IA indisponivel no momento), nao de uma geracao real. */
  readonly fallbackStages: readonly MarketingStageId[];
  /** Nome do Cliente rastreado, quando a campanha foi ligada a um. */
  readonly clientName: string | null;
  /** Soma da duracao real (ms) das chamadas de LLM de cada etapa ja concluida. */
  readonly totalDurationMs: number | null;
  /** Fracao de etapas que reaproveitaram conhecimento de outra campanha do mesmo nicho (0 a 1). */
  readonly reuseRatio: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MarketingAttachment {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

/** Nicho/setor atendido — agrupa campanhas do mesmo setor. */
export interface NicheSummary {
  readonly id: string;
  readonly name: string;
  readonly campaignCount: number;
}

/** Cliente/empresa atendida — pertence a um nicho, conta como "cliente N do setor". */
export interface ClientSummary {
  readonly id: string;
  readonly name: string;
  readonly nicheName: string;
  readonly campaignCount: number;
  readonly setupPaid: boolean;
  readonly recurringActive: boolean;
}

export interface ClientPlans {
  readonly planoTrafego: string | null;
  readonly frameworkPerformance: string | null;
}

export type ClientMetricKind = "TRAFEGO" | "PERFORMANCE";

export interface MetricEntry {
  readonly id: string;
  readonly kind: ClientMetricKind;
  readonly metric: string;
  readonly channel: string | null;
  readonly period: string;
  readonly value: number;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface CreateMetricEntryInput {
  readonly kind: ClientMetricKind;
  readonly metric: string;
  readonly channel?: string;
  readonly period: string;
  readonly value: number;
  readonly note?: string;
}

export interface CreateCampaignInput {
  readonly niche: string;
  readonly briefing: string;
  readonly clientName?: string;
  readonly attachmentName?: string;
  readonly attachmentMimeType?: string;
  readonly attachmentBase64?: string;
}

export interface MarketingOfficeClient {
  listCampaigns(): Promise<readonly MarketingCampaign[]>;
  createCampaign(input: CreateCampaignInput): Promise<MarketingCampaign>;
  getCampaign(id: string): Promise<MarketingCampaign>;
  getAttachment(id: string): Promise<MarketingAttachment>;
  listNiches(): Promise<readonly NicheSummary[]>;
  listClients(): Promise<readonly ClientSummary[]>;
  getClientPlans(id: string): Promise<ClientPlans>;
  listMetricEntries(clientId: string, kind: ClientMetricKind): Promise<readonly MetricEntry[]>;
  createMetricEntry(clientId: string, input: CreateMetricEntryInput): Promise<MetricEntry>;
  deleteMetricEntry(id: string): Promise<void>;
}

export function createMarketingOfficeClient(): MarketingOfficeClient {
  const http = createHttpClient();
  return {
    async listCampaigns() {
      return http.get<readonly MarketingCampaign[]>("/office/marketing/campaigns");
    },
    async createCampaign(input) {
      return http.post<MarketingCampaign>("/office/marketing/campaigns", input);
    },
    async getCampaign(id) {
      return http.get<MarketingCampaign>(`/office/marketing/campaigns/${id}`);
    },
    async getAttachment(id) {
      return http.get<MarketingAttachment>(`/office/marketing/campaigns/${id}/attachment`);
    },
    async listNiches() {
      return http.get<readonly NicheSummary[]>("/office/marketing/niches");
    },
    async listClients() {
      return http.get<readonly ClientSummary[]>("/office/marketing/clients");
    },
    async getClientPlans(id) {
      return http.get<ClientPlans>(`/office/marketing/clients/${id}/plans`);
    },
    async listMetricEntries(clientId, kind) {
      return http.get<readonly MetricEntry[]>(
        `/office/marketing/clients/${clientId}/metrics?kind=${kind}`,
      );
    },
    async createMetricEntry(clientId, input) {
      return http.post<MetricEntry>(`/office/marketing/clients/${clientId}/metrics`, input);
    },
    async deleteMetricEntry(id) {
      await http.delete<{ ok: boolean }>(`/office/marketing/metrics/${id}`);
    },
  };
}
