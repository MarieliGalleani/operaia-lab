/**
 * Porta de geracao de link de afiliado.
 *
 * A API oficial do marketplace entra aqui depois (um adapter novo), sem
 * mexer na Flow nem na Driele. Ate la, o provider manual devolve a URL
 * original marcada como pendente — a Marieli cola o link do portal.
 */

export interface AffiliateLinkRequest {
  readonly productUrl: string;
  /** Identificador da campanha/canal para rastrear de onde veio a venda. */
  readonly subId: string;
}

export interface AffiliateLinkResult {
  readonly url: string;
  readonly pending: boolean;
}

export interface AffiliateLinkProvider {
  readonly name: string;
  createLink(request: AffiliateLinkRequest): Promise<AffiliateLinkResult>;
}

/** Sem API configurada: mantem a URL e sinaliza que falta o link rastreado. */
export class ManualAffiliateLinkProvider implements AffiliateLinkProvider {
  readonly name = "manual";

  async createLink(request: AffiliateLinkRequest): Promise<AffiliateLinkResult> {
    return { url: request.productUrl, pending: true };
  }
}
