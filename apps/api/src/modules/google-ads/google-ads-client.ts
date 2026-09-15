/** Wrapper fino sobre o SDK google-ads-api — monta o Customer autenticado a
 * partir da conexao salva do cliente. */
import { GoogleAdsApi, type Customer } from "google-ads-api";
import { getGoogleAdsAppConfig } from "./google-ads-config.js";

export function getCustomerClient(connection: {
  customerId: string;
  loginCustomerId: string | null;
  refreshToken: string;
}): Customer {
  const config = getGoogleAdsAppConfig();
  const client = new GoogleAdsApi({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    developer_token: config.developerToken,
  });
  return client.Customer({
    customer_id: connection.customerId.replace(/-/g, ""),
    refresh_token: connection.refreshToken,
    login_customer_id: connection.loginCustomerId?.replace(/-/g, "") ?? undefined,
  });
}
