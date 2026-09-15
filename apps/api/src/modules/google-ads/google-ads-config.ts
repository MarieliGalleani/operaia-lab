/**
 * P1.X Fase 8 — Google Ads (video "Google Ads gerenciado pelo Claude").
 *
 * client_id/client_secret/developer_token sao da NOSSA aplicacao (uma so
 * conta Google Cloud, configurada uma vez via .env) — nao por cliente.
 * refresh_token e por cliente, obtido no consentimento OAuth dele
 * (ver google-ads-oauth.service.ts).
 *
 * Sem essas 3 variaveis configuradas, a integracao fica indisponivel:
 * a tela mostra "nao configurado" em vez de tentar conectar e falhar.
 * Isso e esperado ate a conta Google Cloud da OperaIA.lab ser provisionada
 * (Console, API do Google Ads ativada, verificacao de marca, nivel de
 * acesso Basico — o passo a passo real esta descrito no video de origem).
 */
import { env } from "../../config/env.js";

export function isGoogleAdsConfigured(): boolean {
  return Boolean(
    env.GOOGLE_ADS_CLIENT_ID && env.GOOGLE_ADS_CLIENT_SECRET && env.GOOGLE_ADS_DEVELOPER_TOKEN,
  );
}

export function getGoogleAdsAppConfig(): {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  redirectUri: string;
} {
  if (!isGoogleAdsConfigured()) {
    throw new Error(
      "Google Ads nao configurado — defina GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN no .env.",
    );
  }
  return {
    clientId: env.GOOGLE_ADS_CLIENT_ID!,
    clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!,
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    redirectUri: env.GOOGLE_ADS_REDIRECT_URI ?? "http://localhost:3333/api/v1/office/google-ads/callback",
  };
}
