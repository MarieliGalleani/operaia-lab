import type { LLMImageAttachment, LLMMessage } from "@operaia/ai-core";
import type { NicheMemoryHit } from "../crm/niche-memory-store.js";
import {
  AUTOMATION_STAGE_LABEL,
  type AutomationEngagement,
  type AutomationStageId,
} from "./automation-engagement.types.js";

const IMAGE_MIME_PREFIX = "image/";
const MAX_MEMORY_CONTENT_CHARS = 2000;

/**
 * Prompts do Atlas (Automation Specialist) para cada etapa do pipeline de
 * engajamento por cliente — mesma logica do Mercurio (marketing-prompts.ts):
 * cada etapa recebe o briefing original + o que as etapas anteriores ja
 * produziram, pra manter coerencia de principio a fim.
 */

const ATLAS_SYSTEM = `Voce e Atlas, Automation Specialist da OperaIA.lab.
Sua missao: encontrar onde o trabalho manual custa tempo e dinheiro pro
cliente, e desenhar automacoes reais pra resolver isso — nao vender
ferramenta por vender. Voce trabalha em portugues do Brasil, de forma
direta e pratica — sem enrolacao, sem disclaimers, sem "como uma
IA...". Responda SOMENTE com o conteudo pedido, sem introducao nem
comentario sobre a tarefa.

Principios que voce sempre aplica:
- Automatize o que e repetitivo e sem julgamento; deixe humano no que
  exige julgamento, excecao ou empatia.
- Nunca recomende ferramenta antes de entender o processo — processo
  mal desenhado automatizado so erra mais rapido.
- Prefira integrar o que o cliente ja usa a substituir tudo por
  ferramenta nova — trocar de sistema tem custo de adocao alto.
- Seja especifico: "manda lembrete de pagamento por WhatsApp 3 dias
  antes do vencimento" bate "automatize a cobranca".
- Nunca invente numero real de economia de tempo/dinheiro que nao
  possa ser sustentado — use faixas e deixe claro que sao estimativas.`;

function priorContext(engagement: AutomationEngagement): string {
  const parts: string[] = [];
  if (engagement.diagnostico) parts.push(`## Diagnostico Inicial (ja definido)\n${engagement.diagnostico}`);
  if (engagement.mapaProcessos) parts.push(`## Mapa de Processos (ja definido)\n${engagement.mapaProcessos}`);
  if (engagement.automacoesRecomendadas)
    parts.push(`## Automacoes Recomendadas (ja definidas)\n${engagement.automacoesRecomendadas}`);
  if (engagement.arquiteturaIntegracao)
    parts.push(`## Arquitetura de Integracao (ja definida)\n${engagement.arquiteturaIntegracao}`);
  if (engagement.planoImplementacao)
    parts.push(`## Plano de Implementacao (ja definido)\n${engagement.planoImplementacao}`);
  if (engagement.playbookOperacional)
    parts.push(`## Playbook Operacional (ja definido)\n${engagement.playbookOperacional}`);
  return parts.length > 0 ? `\n\nContexto ja produzido neste engajamento:\n\n${parts.join("\n\n")}` : "";
}

function attachmentImages(engagement: AutomationEngagement): readonly LLMImageAttachment[] | undefined {
  if (!engagement.attachmentBase64 || !engagement.attachmentMimeType) return undefined;
  if (!engagement.attachmentMimeType.startsWith(IMAGE_MIME_PREFIX)) return undefined;
  return [{ mimeType: engagement.attachmentMimeType, base64: engagement.attachmentBase64 }];
}

function attachmentTextNote(engagement: AutomationEngagement): string {
  if (!engagement.attachmentBase64 || !engagement.attachmentMimeType) return "";
  if (engagement.attachmentMimeType.startsWith(IMAGE_MIME_PREFIX)) {
    return `\n\nO cliente anexou uma imagem de referencia (${engagement.attachmentName ?? "anexo"}) — considere-a.`;
  }
  if (engagement.attachmentMimeType.startsWith("text/")) {
    try {
      const decoded = Buffer.from(engagement.attachmentBase64, "base64").toString("utf-8");
      return `\n\nConteudo do anexo (${engagement.attachmentName ?? "anexo"}):\n${decoded.slice(0, 6000)}`;
    } catch {
      return "";
    }
  }
  return `\n\nO cliente anexou um arquivo (${engagement.attachmentName ?? "anexo"}, ${engagement.attachmentMimeType}) que ainda nao pode ser lido automaticamente — ignore o conteudo dele.`;
}

/** Conhecimento real de outros engajamentos do MESMO nicho (Cerebro do Nicho) —
 * o mesmo mecanismo do Mercurio, agora tambem alimentando o Atlas. */
function nicheMemoryContext(hits: readonly NicheMemoryHit[] | undefined): string {
  if (!hits || hits.length === 0) return "";
  const blocks = hits.map(
    (hit) =>
      `### ${AUTOMATION_STAGE_LABEL[hit.stage as AutomationStageId]}\n${hit.content.slice(0, MAX_MEMORY_CONTENT_CHARS)}`,
  );
  return `\n\nConhecimento acumulado de outros clientes reais deste MESMO nicho (use como referencia de padrao e o que ja funcionou — adapte ao briefing atual, nunca copie literalmente nem repita nome/dado especifico de outro cliente):\n\n${blocks.join("\n\n")}`;
}

function buildUserPrompt(
  stage: AutomationStageId,
  engagement: AutomationEngagement,
  nicheMemory?: readonly NicheMemoryHit[],
): string {
  const header = `Nicho: ${engagement.niche}\nBriefing do cliente: ${engagement.briefing}${attachmentTextNote(engagement)}${priorContext(engagement)}${nicheMemoryContext(nicheMemory)}`;

  switch (stage) {
    case "DIAGNOSTICO": {
      const hasRealNicheData = Boolean(nicheMemory && nicheMemory.length > 0);
      return `${header}

Tarefa: ANTES de qualquer recomendacao tecnica, monte um Diagnostico
Inicial — a hipotese de ONDE esse negocio provavelmente perde tempo e
dinheiro hoje por falta de automacao. Isso e o que abre a conversa
como especialista, nao como fornecedor generico: voce chega ja
sabendo onde o trabalho manual esta custando caro.

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
    { "processo": string, "hipotese": string, "sinalComum": string, "oQueFazer": string }
  ],
  "avisoTransparencia": string
}

Regras: "baseadoEmDadosReais" deve ser ${hasRealNicheData ? "true" : "false"},
refletindo a realidade acima — nunca minta sobre isso. "resumoExecutivo"
e 2-3 frases diretas, no tom de quem ja identificou o problema.
"hipoteses": 3 a 5 itens cobrindo processos diferentes (ex: atendimento,
agendamento, cobranca, pos-venda, backoffice) — cada "hipotese" e uma
frase especifica e concreta, "sinalComum" e o que normalmente indica
esse problema no dia a dia do nicho, "oQueFazer" e a acao pratica
recomendada. "avisoTransparencia" deve dizer claramente ${
        hasRealNicheData
          ? "que essas hipoteses se apoiam em padroes observados em outros clientes reais deste nicho"
          : "que ainda nao ha dado real de outros clientes deste nicho e que as hipoteses vao ficar mais precisas conforme mais clientes deste setor entrarem na base"
      }. Nunca invente numero ou estatistica especifica. Tudo em portugues
do Brasil.`;
    }

    case "MAPA_PROCESSOS":
      return `${header}

Tarefa: monte o Mapa de Processos completo, em markdown, com estas
secoes:
## Processos Identificados
## Ferramentas em Uso Hoje
## Gargalos e Retrabalho
## Volume Estimado (qualitativo — nunca invente numero exato sem o cliente ter informado)
## Prioridade de Automacao (qual processo automatizar primeiro e por que)`;

    case "AUTOMACOES_RECOMENDADAS":
      return `${header}

Tarefa: com base no Mapa de Processos acima, liste as automacoes
recomendadas. Responda APENAS com um objeto JSON valido (sem markdown,
sem \`\`\`, sem texto antes ou depois), exatamente neste formato:

{
  "automacoes": [
    { "processo": string, "automacaoProposta": string, "ferramentaSugerida": string, "impactoEsperado": string, "complexidade": "baixa" | "media" | "alta" }
  ]
}

Regras: 4 a 7 automacoes, ordenadas da mais simples/impactante pra mais
complexa. "ferramentaSugerida" pode citar categoria (ex: "automacao via
n8n + WhatsApp Business API") sem prometer integracao especifica que
nao foi validada. "impactoEsperado" e qualitativo (ex: "reduz tempo de
resposta de horas pra minutos"), nunca numero fabricado. Tudo em
portugues do Brasil, especifico pro nicho.`;

    case "ARQUITETURA_INTEGRACAO":
      return `${header}

Tarefa: monte a Arquitetura de Integracao tecnica. Responda APENAS com
um objeto JSON valido (sem markdown, sem \`\`\`, sem texto antes ou
depois), exatamente neste formato:

{
  "sistemas": [
    { "nome": string, "papel": string, "tipoIntegracao": string }
  ],
  "fluxoDeDados": string,
  "riscosTecnicos": string[]
}

Regras: "sistemas" cobre so o que foi mencionado no briefing ou e
padrao obvio do nicho (ex: WhatsApp, agenda, planilha) — nunca invente
sistema que o cliente nao usa. "fluxoDeDados" descreve em 3-5 frases
como a informacao vai passar de um sistema pro outro. "riscosTecnicos"
lista 2-4 riscos reais (ex: limite de API, dado duplicado, dependencia
de terceiro). Tudo em portugues do Brasil.`;

    case "PLANO_IMPLEMENTACAO":
      return `${header}

Tarefa: monte o Plano de Implementacao. Responda APENAS com um objeto
JSON valido (sem markdown, sem \`\`\`, sem texto antes ou depois),
exatamente neste formato:

{
  "fases": [
    { "semana": number, "foco": string, "entregaveis": string[] }
  ],
  "dependencias": string[]
}

Regras: 3 a 4 semanas. Cada fase entrega algo testavel, nao so
"planejamento". "dependencias" lista o que precisa estar pronto do
lado do cliente (acesso a sistema, aprovacao de fluxo, etc.) antes de
comecar. Tudo em portugues do Brasil, especifico pro nicho.`;

    case "PLAYBOOK_OPERACIONAL":
      return `${header}

Tarefa: monte o Playbook Operacional — como a equipe do cliente vai
usar as automacoes no dia a dia. Responda APENAS com um objeto JSON
valido (sem markdown, sem \`\`\`, sem texto antes ou depois), exatamente
neste formato:

{
  "comoUsar": string,
  "errosComuns": [
    { "erro": string, "comoResolver": string }
  ],
  "quandoEscalarParaHumano": string[],
  "notaDeAdocao": string
}

Regras: "comoUsar" e um paragrafo direto, sem jargao tecnico — pensado
pra quem vai operar, nao pra quem construiu. 3 "errosComuns" realistas
pro tipo de automacao proposta. "quandoEscalarParaHumano" lista 2-4
situacoes onde a automacao deve parar e chamar uma pessoa (nunca
"automatize tudo sem excecao"). "notaDeAdocao" e uma frase sobre como
introduzir a mudanca pra equipe sem resistencia. Tudo em portugues do
Brasil.`;

    case "FRAMEWORK_MONITORAMENTO":
      return `${header}

Tarefa: monte o Framework de Monitoramento — a estrutura de
acompanhamento pra quando as automacoes estiverem rodando de verdade.
Responda APENAS com um objeto JSON valido (sem markdown, sem \`\`\`, sem
texto antes ou depois), exatamente neste formato:

{
  "metricas": [
    { "nome": string, "oQueMede": string, "frequencia": string, "referenciaDeMercado": string, "seAbaixoDoEsperado": string }
  ],
  "notaImportante": string
}

Regras CRITICAS: isto e um FRAMEWORK (o que medir e como reagir), nao
um relatorio — nunca invente numero de uma automacao que ainda nao
rodou. "referenciaDeMercado" pode citar uma faixa comumente conhecida
(ex: "taxa de erro em automacao de atendimento costuma ficar abaixo de
5% quando bem configurada"), sempre deixando claro que e referencia de
mercado, nao medicao real deste cliente. "notaImportante" deve dizer
explicitamente que os numeros reais só existem depois que as
automacoes estiverem em producao. 4 a 6 metricas (ex: taxa de erro,
tempo economizado, volume processado, taxa de escalonamento pra
humano). Tudo em portugues do Brasil.`;
  }
}

export function buildStageMessages(
  stage: AutomationStageId,
  engagement: AutomationEngagement,
  nicheMemory?: readonly NicheMemoryHit[],
): readonly LLMMessage[] {
  return [
    { role: "system", content: ATLAS_SYSTEM },
    {
      role: "user",
      content: buildUserPrompt(stage, engagement, nicheMemory),
      images: attachmentImages(engagement),
    },
  ];
}
