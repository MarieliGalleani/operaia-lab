/** Cliente tipado do Marketing Office (andar de Marketing) — Mercurio real, sem mock. */
import { createHttpClient } from "./http-client";

export type MarketingStageId =
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
  readonly briefing: string;
  readonly status: "PENDING" | "RUNNING" | "DONE" | "ERROR";
  readonly currentStage: MarketingStageId | null;
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
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MarketingAttachment {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

export interface CreateCampaignInput {
  readonly niche: string;
  readonly briefing: string;
  readonly attachmentName?: string;
  readonly attachmentMimeType?: string;
  readonly attachmentBase64?: string;
}

export interface MarketingOfficeClient {
  listCampaigns(): Promise<readonly MarketingCampaign[]>;
  createCampaign(input: CreateCampaignInput): Promise<MarketingCampaign>;
  getCampaign(id: string): Promise<MarketingCampaign>;
  getAttachment(id: string): Promise<MarketingAttachment>;
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
  };
}
