import type { LLMMessage } from "@operaia/ai-core";
import type { MarketingCampaign, MarketingStageId } from "./marketing-office.types.js";

/**
 * Prompts do Mercurio (Marketing Lead) para cada etapa do pipeline.
 * Cada etapa recebe o briefing original + o que as etapas anteriores
 * ja produziram, para manter coerencia de principio a fim — igual um
 * funcionario de verdade nao esquece o que ja decidiu.
 */

const MERCURIO_SYSTEM = `Voce e Mercurio, Marketing Lead da OperaIA.lab.
Sua missao: levar cada produto ao publico certo com a mensagem certa.
Voce trabalha em portugues do Brasil, de forma direta e pratica — sem
enrolacao, sem disclaimers, sem "como uma IA...". Responda SOMENTE com
o conteudo pedido, sem introducao nem comentario sobre a tarefa.`;

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
frases), Gancho visual sugerido, CTA. Ao final, indique qual dos 5 e o
mais forte para virar a Landing Page e por que.`;

    case "LANDING_PAGE":
      return `${header}

Tarefa: gere uma landing page COMPLETA em um unico arquivo HTML,
usando o conceito criativo mais forte definido acima. Requisitos:
- HTML5 completo (<!doctype html> ate </html>), CSS inline em <style>
  no <head>, sem dependencias externas (sem CDN, sem fontes externas).
- Responsivo (mobile-first), visual moderno e profissional.
- Secoes: headline de impacto, subheadline, 3 beneficios/provas,
  1 CTA principal repetido 2x, rodape simples.
- Copy 100% em portugues do Brasil, especifica para o nicho.
- Responda APENAS com o HTML puro, sem blocos de codigo markdown nem
  qualquer texto antes ou depois.`;

    case "PITCH_DECK":
      return `${header}

Tarefa: monte o roteiro de um Pitch Deck de vendas, em markdown, um
titulo "## Slide N — <titulo>" por slide, com o conteudo-chave de cada
slide (bullets curtos). Estrutura sugerida: Problema, Custo de nao
agir, Solucao, Como funciona, Prova/resultados, Oferta, Proximos
passos.`;

    case "PLANO_GTM":
      return `${header}

Tarefa: escreva o Plano de Go-to-Market, em markdown, com:
## Canais prioritarios (e por que)
## Cronograma 30/60/90 dias
## Orcamento sugerido por canal (proporcional, sem inventar numeros
  absolutos de reais — use percentuais)
## KPIs de acompanhamento`;

    case "PLAYBOOK_VENDAS":
      return `${header}

Tarefa: escreva o Playbook de Vendas, em markdown, com:
## Script de abordagem inicial
## Perguntas de qualificacao
## Quebra das 3 objecoes mais comuns deste nicho (da secao Objecoes do
  Mapa de Nicho)
## Sequencia de follow-up (o que falar em cada tentativa)
## Frase de fechamento`;
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
