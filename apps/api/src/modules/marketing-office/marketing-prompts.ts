import type { LLMMessage } from "@operaia/ai-core";
import type { MarketingCampaign, MarketingStageId } from "./marketing-office.types.js";

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
  if (campaign.nicheMap) parts.push(`## Mapa de Nicho (ja definido)\n${campaign.nicheMap}`);
  if (campaign.creatives) parts.push(`## Criativos (ja definidos)\n${campaign.creatives}`);
  if (campaign.landingPageHtml) parts.push(`## Landing Page (ja definida, HTML)\n(ja existe, nao repita aqui)`);
  if (campaign.pitchDeck) parts.push(`## Pitch Deck (ja definido)\n${campaign.pitchDeck}`);
  if (campaign.gtmPlan) parts.push(`## Plano de GTM (ja definido)\n${campaign.gtmPlan}`);
  return parts.length > 0 ? `\n\nContexto ja produzido nesta campanha:\n\n${parts.join("\n\n")}` : "";
}

function buildUserPrompt(stage: MarketingStageId, campaign: MarketingCampaign): string {
  const header = `Nicho: ${campaign.niche}\nBriefing do cliente: ${campaign.briefing}${priorContext(campaign)}`;

  switch (stage) {
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
  }
}

export function buildStageMessages(
  stage: MarketingStageId,
  campaign: MarketingCampaign,
): readonly LLMMessage[] {
  return [
    { role: "system", content: MERCURIO_SYSTEM },
    { role: "user", content: buildUserPrompt(stage, campaign) },
  ];
}
