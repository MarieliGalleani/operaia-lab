import type { MarketingCampaign as PrismaMarketingCampaign } from "@operaia/database";

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

export const MARKETING_STAGE_FIELD: Readonly<
  Record<MarketingStageId, keyof PrismaMarketingCampaign>
> = {
  DIAGNOSTICO: "diagnostico",
  MAPA_NICHO: "nicheMap",
  CRIATIVOS: "creatives",
  LANDING_PAGE: "landingPageHtml",
  PITCH_DECK: "pitchDeck",
  PLANO_GTM: "gtmPlan",
  PLAYBOOK_VENDAS: "salesPlaybook",
  VIDEO_ROTEIRO: "videoRoteiro",
  PLANO_TRAFEGO: "planoTrafego",
  FRAMEWORK_PERFORMANCE: "frameworkPerformance",
};

export type MarketingCampaign = PrismaMarketingCampaign;
