/** Integração com Google Ads (P1.X Fase 8) — o "video 2": pesquisa de termos,
 * negativação assistida (humano aprova) e leitura de fatia de impressão
 * perdida, tudo por cliente do andar de Marketing. */
import { createHttpClient, resolveApiV1BaseUrl } from "./http-client";

export interface GoogleAdsConnectionStatus {
  readonly configured: boolean;
  readonly connected: boolean;
  readonly customerId: string | null;
  readonly lastSyncAt: string | null;
  readonly lastError: string | null;
}

export interface NegativeKeywordRecommendation {
  readonly term: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly costBrl: number;
  readonly clicks: number;
  readonly reason: string;
}

export interface LostImpressionShareInsight {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly impressionSharePct: number;
  readonly lostToBudgetPct: number;
  readonly lostToRankPct: number;
  readonly mainCause: "orcamento" | "lance_ou_qualidade" | "sem_perda_relevante";
}

export interface AccountSummary {
  readonly costBrl: number;
  readonly conversions: number;
  readonly clicks: number;
  readonly impressions: number;
  readonly costPerConversionBrl: number | null;
}

export interface GoogleAdsAnalysis {
  readonly summary: AccountSummary;
  readonly negativeKeywordRecommendations: readonly NegativeKeywordRecommendation[];
  readonly lostImpressionShare: readonly LostImpressionShareInsight[];
}

export interface GoogleAdsClient {
  getStatus(clientId: string): Promise<GoogleAdsConnectionStatus>;
  /** URL de navegação completa (302 pro consentimento do Google) — não é uma chamada fetch. */
  buildConnectUrl(clientId: string, customerId: string, loginCustomerId?: string): string;
  disconnect(clientId: string): Promise<void>;
  getAnalysis(clientId: string): Promise<GoogleAdsAnalysis>;
  applyNegativeKeyword(clientId: string, campaignId: string, term: string): Promise<void>;
}

export function createGoogleAdsClient(): GoogleAdsClient {
  const http = createHttpClient();
  const baseUrl = resolveApiV1BaseUrl();
  return {
    async getStatus(clientId) {
      return http.get<GoogleAdsConnectionStatus>(`/office/google-ads/clients/${clientId}/status`);
    },
    buildConnectUrl(clientId, customerId, loginCustomerId) {
      const params = new URLSearchParams({ customerId });
      if (loginCustomerId) params.set("loginCustomerId", loginCustomerId);
      return `${baseUrl}/office/google-ads/clients/${clientId}/connect?${params.toString()}`;
    },
    async disconnect(clientId) {
      await http.post<{ ok: boolean }>(`/office/google-ads/clients/${clientId}/disconnect`, {});
    },
    async getAnalysis(clientId) {
      return http.get<GoogleAdsAnalysis>(`/office/google-ads/clients/${clientId}/analysis`);
    },
    async applyNegativeKeyword(clientId, campaignId, term) {
      await http.post<{ ok: boolean }>(`/office/google-ads/clients/${clientId}/recommendations/apply`, {
        campaignId,
        term,
      });
    },
  };
}
