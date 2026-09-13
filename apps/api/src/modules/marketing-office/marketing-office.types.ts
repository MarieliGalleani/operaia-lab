import type { MarketingCampaign as PrismaMarketingCampaign } from "@operaia/database";

export type MarketingStageId =
  | "MAPA_NICHO"
  | "CRIATIVOS"
  | "LANDING_PAGE"
  | "PITCH_DECK"
  | "PLANO_GTM"
  | "PLAYBOOK_VENDAS";

export const MARKETING_STAGE_ORDER: readonly MarketingStageId[] = [
  "MAPA_NICHO",
  "CRIATIVOS",
  "LANDING_PAGE",
  "PITCH_DECK",
  "PLANO_GTM",
  "PLAYBOOK_VENDAS",
];

export const MARKETING_STAGE_LABEL: Readonly<Record<MarketingStageId, string>> = {
  MAPA_NICHO: "Mapa de Nicho",
  CRIATIVOS: "Criativos",
  LANDING_PAGE: "Landing Page",
  PITCH_DECK: "Pitch Deck",
  PLANO_GTM: "Plano de GTM",
  PLAYBOOK_VENDAS: "Playbook de Vendas",
};

export const MARKETING_STAGE_FIELD: Readonly<
  Record<MarketingStageId, keyof PrismaMarketingCampaign>
> = {
  MAPA_NICHO: "nicheMap",
  CRIATIVOS: "creatives",
  LANDING_PAGE: "landingPageHtml",
  PITCH_DECK: "pitchDeck",
  PLANO_GTM: "gtmPlan",
  PLAYBOOK_VENDAS: "salesPlaybook",
};

export type MarketingCampaign = PrismaMarketingCampaign;
