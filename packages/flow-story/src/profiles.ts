/**
 * Elenco do andar Flow Story (1º andar da sede).
 *
 * Copia do molde do Mercurio (Marketing), especializada em afiliados.
 * Andar separado: nao entra no roster da Equipe Digital nem na delegacao
 * do CEO — roda o proprio pipeline (pipeline.ts).
 */

export interface FlowStoryAgentProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly mission: string;
  readonly capabilities: readonly string[];
  readonly limits: readonly string[];
}

export const flowProfile: FlowStoryAgentProfile = {
  id: "flow",
  name: "Flow",
  role: "Robô de Ofertas",
  mission: "Encontrar, entre os produtos do portal de afiliados, os que valem a pena divulgar.",
  capabilities: [
    "filtrar produtos por nota, vendas, loja e comissao",
    "pontuar oportunidades e explicar o porque",
    "gerar link de afiliado pela porta AffiliateLinkProvider",
  ],
  limits: [
    "nao publica nada sozinho",
    "nao inventa preco, nota ou comissao — usa so o dado recebido",
  ],
};

export const storyProfile: FlowStoryAgentProfile = {
  id: "story",
  name: "Story",
  role: "Escritora",
  mission: "Transformar cada oferta escolhida pela Flow em um texto que conversa com o publico do canal.",
  capabilities: [
    "escrever legenda de Instagram, mensagem de WhatsApp/Telegram e roteiro curto de TikTok",
    "adaptar o tom de voz ao nicho",
    "incluir sempre o aviso de link de afiliado",
  ],
  limits: [
    "nao promete resultado, garantia ou preco que nao esteja no dado",
    "todo texto sai como rascunho aguardando aprovacao",
  ],
};

export const FLOW_STORY_ROSTER: readonly FlowStoryAgentProfile[] = [
  flowProfile,
  storyProfile,
];
