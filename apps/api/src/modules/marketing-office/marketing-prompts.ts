import type { LLMImageAttachment, LLMMessage } from "@operaia/ai-core";
import type { NicheMemoryHit } from "./niche-memory-store.js";
import { MARKETING_STAGE_LABEL, type MarketingCampaign, type MarketingStageId } from "./marketing-office.types.js";

const IMAGE_MIME_PREFIX = "image/";
const MAX_MEMORY_CONTENT_CHARS = 2000;

/**
 * Prompts do Mercurio (Marketing Lead) para cada etapa do pipeline.
 * Cada etapa recebe o briefing original + o que as etapas anteriores
 * ja produziram, para manter coerencia de principio a fim — igual um
 * funcionario de verdade nao esquece o que ja decidiu.
 *
 * Principios de copy/CRO/design abaixo sao uma destilacao adaptada de
 * bibliotecas de skills reais (copywriting, cro, ad-creative,
 * high-end-visual-design) — nao os arquivos originais (que assumem
 * Tailwind/React + fontes externas), mas os principios centrais deles
 * reescritos para caber na restricao real desta etapa: HTML de arquivo
 * unico, sem CDN, sem fonte externa, sem JS (o preview roda num iframe
 * sandbox sem scripts).
 */

const MERCURIO_SYSTEM = `Voce e Mercurio, Marketing Lead da OperaIA.lab.
Sua missao: levar cada produto ao publico certo com a mensagem certa.
Voce trabalha em portugues do Brasil, de forma direta e pratica — sem
enrolacao, sem disclaimers, sem "como uma IA...". Responda SOMENTE com
o conteudo pedido, sem introducao nem comentario sobre a tarefa.

Principios de copywriting que voce sempre aplica:
- Clareza vence esperteza. Se tiver que escolher entre claro e
  criativo, escolha claro.
- Beneficio, nao feature: diga o que muda pra vida do cliente, nao o
  que o produto faz por dentro.
- Especifico vence vago: "de 4 horas pra 15 minutos" bate "economize
  tempo".
- Linguagem do cliente, nao da empresa: espelhe como o proprio nicho
  fala do problema, nao jargao de marketing.
- CTA fraco: "Enviar", "Saiba mais", "Cadastre-se". CTA forte: verbo de
  acao + o que a pessoa ganha ("Agende sua avaliacao gratis", "Veja
  seus horarios disponiveis").
- Um visitante precisa entender o que e e por que importa em 5
  segundos.`;

function priorContext(campaign: MarketingCampaign): string {
  const parts: string[] = [];
  if (campaign.diagnostico) parts.push(`## Diagnostico Inicial (ja definido)\n${campaign.diagnostico}`);
  if (campaign.nicheMap) parts.push(`## Mapa de Nicho (ja definido)\n${campaign.nicheMap}`);
  if (campaign.creatives) parts.push(`## Criativos (ja definidos)\n${campaign.creatives}`);
  if (campaign.landingPageHtml) parts.push(`## Landing Page (ja definida, HTML)\n(ja existe, nao repita aqui)`);
  if (campaign.pitchDeck) parts.push(`## Pitch Deck (ja definido)\n${campaign.pitchDeck}`);
  if (campaign.gtmPlan) parts.push(`## Plano de GTM (ja definido)\n${campaign.gtmPlan}`);
  if (campaign.videoRoteiro) parts.push(`## Roteiro de Video (ja definido)\n${campaign.videoRoteiro}`);
  if (campaign.planoTrafego) parts.push(`## Plano de Trafego Pago (ja definido)\n${campaign.planoTrafego}`);
  return parts.length > 0 ? `\n\nContexto ja produzido nesta campanha:\n\n${parts.join("\n\n")}` : "";
}

/** Anexo de imagem enviado no briefing (logo, print de anuncio, referencia
 * visual) — o Mercurio "ve" a imagem de verdade via multimodal, quando o
 * provider suportar (Gemini/Claude); providers sem suporte so ignoram. */
function attachmentImages(campaign: MarketingCampaign): readonly LLMImageAttachment[] | undefined {
  if (!campaign.attachmentBase64 || !campaign.attachmentMimeType) return undefined;
  if (!campaign.attachmentMimeType.startsWith(IMAGE_MIME_PREFIX)) return undefined;
  return [{ mimeType: campaign.attachmentMimeType, base64: campaign.attachmentBase64 }];
}

/** Anexo de texto puro (ex: .txt/.md) — conteudo entra direto no prompt. */
function attachmentTextNote(campaign: MarketingCampaign): string {
  if (!campaign.attachmentBase64 || !campaign.attachmentMimeType) return "";
  if (campaign.attachmentMimeType.startsWith(IMAGE_MIME_PREFIX)) {
    return `\n\nO cliente anexou uma imagem de referencia (${campaign.attachmentName ?? "anexo"}) — considere-a.`;
  }
  if (campaign.attachmentMimeType.startsWith("text/")) {
    try {
      const decoded = Buffer.from(campaign.attachmentBase64, "base64").toString("utf-8");
      return `\n\nConteudo do anexo (${campaign.attachmentName ?? "anexo"}):\n${decoded.slice(0, 6000)}`;
    } catch {
      return "";
    }
  }
  return `\n\nO cliente anexou um arquivo (${campaign.attachmentName ?? "anexo"}, ${campaign.attachmentMimeType}) que ainda nao pode ser lido automaticamente — ignore o conteudo dele.`;
}

/** Conhecimento real de outras campanhas do MESMO nicho (Cerebro do Nicho, Fase 2) —
 * e o que faz a 6a campanha de um setor sair mais rapida e melhor que a 1a. */
function nicheMemoryContext(hits: readonly NicheMemoryHit[] | undefined): string {
  if (!hits || hits.length === 0) return "";
  const blocks = hits.map(
    (hit) => `### ${MARKETING_STAGE_LABEL[hit.stage]}\n${hit.content.slice(0, MAX_MEMORY_CONTENT_CHARS)}`,
  );
  return `\n\nConhecimento acumulado de outras campanhas reais ja feitas neste MESMO nicho (use como referencia de padrao, qualidade e o que ja funcionou — adapte ao briefing atual, nunca copie literalmente nem repita nome/dado especifico de outro cliente):\n\n${blocks.join("\n\n")}`;
}

function buildUserPrompt(
  stage: MarketingStageId,
  campaign: MarketingCampaign,
  nicheMemory?: readonly NicheMemoryHit[],
): string {
  const header = `Nicho: ${campaign.niche}\nBriefing do cliente: ${campaign.briefing}${attachmentTextNote(campaign)}${priorContext(campaign)}${nicheMemoryContext(nicheMemory)}`;

  switch (stage) {
    case "DIAGNOSTICO": {
      const hasRealNicheData = Boolean(nicheMemory && nicheMemory.length > 0);
      return `${header}

Tarefa: ANTES de qualquer entrega tatica, monte um Diagnostico Inicial —
a hipotese de ONDE esse negocio provavelmente esta perdendo dinheiro
hoje. Isso e o que abre a conversa como especialista de mercado, nao
como fornecedor generico: voce chega ja sabendo onde o negocio sangra,
em vez de perguntar "o que voce quer automatizar?".

${
  hasRealNicheData
    ? "Voce TEM acesso a padroes reais observados em outros clientes reais deste MESMO nicho (secao de contexto acima) — baseie as hipoteses neles quando fizer sentido, sem citar nome ou dado especifico de outro cliente."
    : "Este e o PRIMEIRO cliente deste nicho na base — voce ainda NAO tem dado real de outros clientes deste setor. Baseie as hipoteses em conhecimento geral de mercado do nicho, e deixe isso EXPLICITO na resposta (nunca finja ter dado que nao tem)."
}

Responda APENAS com um objeto JSON valido (sem markdown, sem \`\`\`, sem
texto antes ou depois), exatamente neste formato:

{
  "baseadoEmDadosReais": boolean,
  "resumoExecutivo": string,
  "hipoteses": [
    { "area": string, "hipotese": string, "sinalComum": string, "oQueFazer": string }
  ],
  "avisoTransparencia": string
}

Regras: "baseadoEmDadosReais" deve ser ${hasRealNicheData ? "true" : "false"},
refletindo a realidade acima — nunca minta sobre isso. "resumoExecutivo"
e 2-3 frases diretas, no tom de quem ja identificou o problema, nao de
quem esta perguntando. "hipoteses": 3 a 5 itens cobrindo areas
diferentes (ex: vendas, pos-venda, backoffice, marketing) — cada
"hipotese" e uma frase especifica e concreta (nunca generica tipo
"melhorar atendimento"), "sinalComum" e o que normalmente indica esse
problema no dia a dia do nicho, "oQueFazer" e a acao pratica
recomendada. "avisoTransparencia" deve dizer claramente ${
        hasRealNicheData
          ? "que essas hipoteses se apoiam em padroes observados em outros clientes reais deste nicho"
          : "que ainda nao ha dado real de outros clientes deste nicho e que as hipoteses vao ficar mais precisas conforme mais clientes deste setor entrarem na base"
      }. Nunca invente numero ou estatistica especifica. Tudo em portugues
do Brasil.`;
    }

    case "MAPA_NICHO":
      return `${header}

Tarefa: monte o Mapa de Nicho completo, em markdown, com estas secoes:
## Publico-alvo
## Dores
## Desejos
## Objecoes mais comuns
## Tamanho e potencial do mercado
## Concorrencia direta e indireta
## Angulo de posicionamento recomendado`;

    case "CRIATIVOS":
      return `${header}

Tarefa: com base no Mapa de Nicho acima, crie 5 conceitos criativos para
anuncios/posts, em markdown. Para cada um: ## Headline, Copy curto (2-3
frases), Gancho visual sugerido, CTA. Use formulas de headline testadas
quando fizer sentido: "Consiga {resultado} sem {dor}", "Nunca mais
{coisa ruim} de novo", ou uma pergunta que nomeia a dor direto. CTA
sempre no formato verbo + o que a pessoa ganha, nunca generico. Ao
final, indique qual dos 5 e o mais forte para virar a Landing Page e
por que.`;

    case "LANDING_PAGE":
      return `${header}

Tarefa: gere uma landing page COMPLETA em um unico arquivo HTML,
usando o conceito criativo mais forte definido acima.

Requisitos tecnicos:
- HTML5 completo (<!doctype html> ate </html>), CSS inline em <style>
  no <head>, sem dependencias externas (sem CDN, sem fontes externas,
  sem JavaScript — o preview roda sandboxed sem scripts).
- Responsivo (mobile-first).

Requisitos de estrutura (copy/CRO):
- Headline unico e especifico (nao tente falar tudo de uma vez).
- Subheadline de 1-2 frases expandindo o headline.
- 1 CTA principal repetido no topo e no fim, com copy forte (verbo +
  beneficio, nunca "Enviar"/"Saiba mais").
- 3 beneficios/provas — beneficio (o que muda pra vida do cliente), nao
  so a feature.
- Prova social ou credibilidade (mesmo que generica: "atendimento
  humanizado", "avaliacao sem compromisso") quando nao houver numero
  real pra usar — nunca invente estatistica ou depoimento especifico.
- Rodape simples com nome do negocio.

Requisitos visuais (para nao parecer template generico):
- Espacamento generoso entre secoes (respire — nao amontoe).
- Uma paleta de 2-3 cores coerente com o nicho, nao a paleta padrao
  azul-cinza de SaaS.
- Sombras suaves e sutis (nunca cinza solido pesado) para dar
  profundidade a cards/botoes.
- Cantos arredondados consistentes (escolha um raio e mantenha).
- Tipografia do sistema (system-ui, -apple-system, Segoe UI, Roboto)
  em pesos variados (700 para headline, 400-500 para corpo) — sem
  depender de fonte externa.
- Transicoes CSS simples em hover (cor, sombra) sao permitidas mesmo
  sem JS.

Copy 100% em portugues do Brasil, especifica para o nicho. Responda
APENAS com o HTML puro, sem blocos de codigo markdown nem qualquer
texto antes ou depois.`;

    case "PITCH_DECK":
      return `${header}

Tarefa: monte o roteiro de um Pitch Deck de vendas, em markdown, um
titulo "## Slide N — <titulo>" por slide, com o conteudo-chave de cada
slide (bullets curtos). Estrutura sugerida: Problema, Custo de nao
agir, Solucao, Como funciona, Prova/resultados, Oferta, Proximos
passos.`;

    case "PLANO_GTM":
      return `${header}

Tarefa: monte o Plano de Go-to-Market. Responda APENAS com um objeto
JSON valido (sem markdown, sem \`\`\`, sem texto antes ou depois),
exatamente neste formato:

{
  "canais": [{ "nome": string, "motivo": string }],
  "cronograma": [
    { "semana": number, "foco": string, "acoes": string[] }
  ],
  "orcamento": [{ "canal": string, "percentual": number }],
  "kpis": string[]
}

Regras: 4 semanas no cronograma (semana 1 a 4). "orcamento" e uma
distribuicao percentual entre os canais listados em "canais" (soma
100). Nao invente numeros absolutos de reais. Tudo em portugues do
Brasil, especifico para o nicho.`;

    case "PLAYBOOK_VENDAS":
      return `${header}

Tarefa: monte o Playbook de Vendas. Responda APENAS com um objeto JSON
valido (sem markdown, sem \`\`\`, sem texto antes ou depois), exatamente
neste formato:

{
  "scriptAbordagem": string,
  "perguntasQualificacao": string[],
  "objecoes": [{ "objecao": string, "resposta": string }],
  "followUp": [{ "tentativa": number, "canal": string, "mensagem": string }],
  "fechamento": string
}

Regras: 3 objecoes (baseadas na secao Objecoes do Mapa de Nicho acima).
4 tentativas de follow-up, cada uma como se fosse uma mensagem real de
WhatsApp (curta, direta, sem formalidade excessiva). Tudo em portugues
do Brasil, especifico para o nicho.`;

    case "VIDEO_ROTEIRO":
      return `${header}

Tarefa: monte o roteiro de um video curto (Reels/TikTok/Shorts) pro
conceito criativo mais forte definido acima. Responda APENAS com um
objeto JSON valido (sem markdown, sem \`\`\`, sem texto antes ou
depois), exatamente neste formato:

{
  "formato": string,
  "duracaoTotalSeg": number,
  "gancho": string,
  "cenas": [
    { "ordem": number, "duracaoSeg": number, "oQueAparece": string, "textoNaTela": string, "narracaoOuAudio": string }
  ],
  "ctaFinal": string
}

Regras: "gancho" e o que prende a atencao nos primeiros 3 segundos —
nunca comece devagar. 4 a 6 cenas. "duracaoTotalSeg" entre 15 e 45.
Tudo em portugues do Brasil, especifico para o nicho e coerente com o
conceito criativo escolhido.`;

    case "PLANO_TRAFEGO":
      return `${header}

Tarefa: monte o Plano de Trafego Pago (o gestor de trafego define
estrategia — plataforma, publico, orcamento — sem configurar lance
manualmente, isso a propria plataforma otimiza hoje). Responda APENAS
com um objeto JSON valido (sem markdown, sem \`\`\`, sem texto antes ou
depois), exatamente neste formato:

{
  "objetivoCampanha": string,
  "plataformaPrincipal": string,
  "motivoPlataforma": string,
  "publicos": [{ "nome": string, "descricao": string }],
  "conjuntosDeAnuncio": [{ "nome": string, "publicoAlvo": string, "criativosNecessarios": number }],
  "distribuicaoOrcamento": [{ "conjunto": string, "percentual": number }],
  "estrategiaDeLance": string,
  "sinaisParaOtimizar": string[]
}

Regras: "distribuicaoOrcamento" e percentual entre os conjuntos (soma
100) — nunca invente valor absoluto em reais. "estrategiaDeLance" deve
citar que a otimizacao automatica da propria plataforma (Advantage+ no
Meta, Performance Max no Google) e o padrao de 2026 — o trabalho
humano e definir objetivo/publico/orcamento, nao ajustar lance a mao.
Tudo em portugues do Brasil, especifico para o nicho.`;

    case "FRAMEWORK_PERFORMANCE":
      return `${header}

Tarefa: monte o Framework de Performance — a estrutura de
acompanhamento pra quando as campanhas estiverem rodando de verdade.
Responda APENAS com um objeto JSON valido (sem markdown, sem \`\`\`, sem
texto antes ou depois), exatamente neste formato:

{
  "metricas": [
    { "nome": string, "canal": string, "frequencia": string, "referenciaDeMercado": string, "seAbaixoDoEsperado": string }
  ],
  "notaImportante": string
}

Regras CRITICAS: isto e um FRAMEWORK (o que medir e como reagir), nao
um relatorio — nunca invente numero de uma campanha que ainda nao
rodou. "referenciaDeMercado" pode citar uma faixa comumente conhecida
do mercado (ex: "CTR de Meta Ads costuma ficar entre 1% e 2% no
nicho"), sempre deixando claro que e referencia de mercado, nao
medicao real desta campanha. "notaImportante" deve dizer explicitamente
que os numeros reais só existem depois que uma conta de anuncios for
conectada. 5 a 7 metricas cobrindo os canais definidos no Plano de GTM
e no Plano de Trafego. Tudo em portugues do Brasil.`;
  }
}

export function buildStageMessages(
  stage: MarketingStageId,
  campaign: MarketingCampaign,
  nicheMemory?: readonly NicheMemoryHit[],
): readonly LLMMessage[] {
  return [
    { role: "system", content: MERCURIO_SYSTEM },
    {
      role: "user",
      content: buildUserPrompt(stage, campaign, nicheMemory),
      images: attachmentImages(campaign),
    },
  ];
}
