/** Fluxo OAuth de consentimento do cliente pra conectar a conta dele de Google Ads. */
import { OAuth2Client } from "google-auth-library";
import { getGoogleAdsAppConfig } from "./google-ads-config.js";

const SCOPE = "https://www.googleapis.com/auth/adwords";

function buildOAuthClient(): OAuth2Client {
  const config = getGoogleAdsAppConfig();
  return new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
}

export interface OAuthState {
  readonly clientId: string;
  readonly customerId: string;
  readonly loginCustomerId?: string;
}

function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state), "utf-8").toString("base64url");
}

export function decodeState(raw: string): OAuthState {
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")) as OAuthState;
}

/** URL de consentimento — "state" carrega o clientId da OperaIA.lab + a conta
 * de Google Ads que ele quer conectar, pra sabermos o que fazer quando o
 * Google redirecionar de volta pro callback. */
export function buildAuthUrl(state: OAuthState): string {
  const oauth = buildOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
    state: encodeState(state),
  });
}

export interface ExchangedTokens {
  readonly refreshToken: string;
}

/** Troca o "code" do callback OAuth por um refresh_token — falha se o Google
 * nao retornar um (acontece se o usuario ja tinha consentido antes sem
 * access_type=offline; por isso sempre pedimos prompt=consent acima). */
export async function exchangeCodeForRefreshToken(code: string): Promise<ExchangedTokens> {
  const oauth = buildOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google nao retornou refresh_token — revogue o acesso da aplicacao na conta Google e tente conectar de novo.",
    );
  }
  return { refreshToken: tokens.refresh_token };
}
