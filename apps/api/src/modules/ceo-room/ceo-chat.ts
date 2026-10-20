/**
 * Chat da Sala da Opera.
 *
 * Antes cada mensagem virava uma missao inteira (poluia a linha do tempo)
 * e a resposta era um texto pronto sobre o workspace "nexo". Agora:
 *   - a Opera responde a partir do retrato real do escritorio (ceo-briefing);
 *   - conversa nao cria missao; quando o pedido e trabalho, ela propoe uma
 *     demanda e a usuaria confirma (passa pelo fluxo normal, com risco e
 *     aprovacao);
 *   - sem IA (Claude sem credito + Gemini fora), responde com os fatos do
 *     retrato e avisa — nunca um texto generico.
 */
import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import { OFFICIAL_OPERATIONAL_WORKSPACES } from "../projects/official-operational-catalog.js";
import type { CeoBriefing } from "./ceo-briefing.js";

export interface ChatTurn {
  readonly role: "user" | "opera";
  readonly text: string;
}

export interface SuggestedDemand {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly text: string;
}

export interface OperaReply {
  readonly answer: string;
  readonly usedAi: boolean;
  readonly model: string;
  readonly suggestedDemand: SuggestedDemand | null;
  readonly briefingAt: string;
}

const WORKSPACES = OFFICIAL_OPERATIONAL_WORKSPACES.map((w) => ({ id: w.workspaceId, name: w.name, kind: w.kind }));

function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Projeto citado na mensagem (nome ou id, sem acento). */
export function detectWorkspace(message: string): { id: string; name: string } | null {
  const m = fold(message);
  // nomes mais longos primeiro: "Podiário Site" antes de "Podiário"
  const sorted = [...WORKSPACES].sort((a, b) => b.name.length - a.name.length);
  for (const w of sorted) {
    if (m.includes(fold(w.name)) || m.includes(w.id)) return { id: w.id, name: w.name };
  }
  return null;
}

const WORK_VERBS =
  /\b(faca|faz|crie|cria|criar|corrija|corrigir|arrume|arruma|implemente|implementar|analise|analisar|revise|revisar|escreva|escrever|prepare|preparar|ajuste|ajustar|monte|montar|gere|gerar|atualize|atualizar|investigue|investigar|documente|documentar|refatore|teste|testar)\b/;

export function looksLikeWork(message: string): boolean {
  return WORK_VERBS.test(fold(message));
}

function compactBriefing(b: CeoBriefing): string {
  const lines: string[] = [];
  const h = b.health;
  lines.push(
    h
      ? `Saúde: ${h.label} — ${h.summary}. Workers ${h.workersAlive}/${h.workersExpected}. Fila: ${h.queued} na fila, ${h.running} rodando, ${h.waiting} esperando.`
      : "Saúde: indisponível agora.",
  );
  lines.push(
    `Últimas 24h: ${b.counts24h.completed} missões concluídas, ${b.counts24h.failed} falharam; ${b.counts24h.human} pedidas pela Marieli, ${b.counts24h.automatic} automáticas (revisões do escritório).`,
  );
  lines.push(
    b.approvalsPending.length
      ? `Aprovações esperando a Marieli (${b.approvalsPending.length}):\n${b.approvalsPending.map((a) => `  - [risco ${a.risk}] ${a.title} (${a.workspaceName})`).join("\n")}`
      : "Aprovações esperando a Marieli: nenhuma.",
  );
  lines.push(
    b.running.length
      ? `Rodando agora:\n${b.running.map((m) => `  - ${m.objective} (${m.workspaceName})`).join("\n")}`
      : "Rodando agora: nada.",
  );
  if (b.queued.length) lines.push(`Na fila:\n${b.queued.map((m) => `  - ${m.objective} (${m.workspaceName})`).join("\n")}`);
  lines.push(
    b.failures.length
      ? `Falhas nas últimas 24h:\n${b.failures.map((f) => `  - ${f.objective} (${f.workspaceName}): ${f.error}`).join("\n")}`
      : "Falhas nas últimas 24h: nenhuma.",
  );
  if (b.deliveries.length) {
    lines.push(
      `Entregas de demandas da Marieli (7 dias):\n${b.deliveries
        .map(
          (d) =>
            `  - Pedido: "${d.request}" (${d.workspaceName}, por ${d.employeeId}) → ${d.summary || "entrega sem conteúdo útil (feita no modo reserva, sem IA)"}${d.recommendations.length ? ` | Recomendações: ${d.recommendations.join("; ")}` : ""}`,
        )
        .join("\n")}`,
    );
  }
  if (b.floorRuns.length) {
    lines.push(
      `Trabalhos do Atlas (automação) e Mercúrio (marketing) em 7 dias:\n${b.floorRuns
        .map((r) => `  - ${r.floor === "automation" ? "Atlas" : "Mercúrio"}: ${r.title} — ${r.status}${r.allFallback ? " (todas as etapas sem IA)" : ""}`)
        .join("\n")}`,
    );
  }
  lines.push(
    `Projetos do escritório (${b.projects.length}): ${b.projects
      .map((p) => `${p.name} [${p.workspaceId}, ${p.kind}${p.missions24h ? `, ${p.missions24h} missões/24h` : ""}${p.failures24h ? `, ${p.failures24h} falhas` : ""}]`)
      .join("; ")}`,
  );
  return lines.join("\n");
}

export function buildOperaMessages(input: {
  readonly message: string;
  readonly history: readonly ChatTurn[];
  readonly briefing: CeoBriefing;
}): LLMMessage[] {
  const system = [
    "Você é a Opera, CEO do OperaIA.lab — o escritório virtual de agentes de IA da Marieli Galleani (a dona da empresa).",
    "Fale em português do Brasil, direto e humano, como uma CEO que conhece o escritório inteiro. Frases curtas. Sem jargão interno (nada de 'gate', 'workspace_id', 'missão raiz').",
    "Responda SOMENTE com base no RETRATO DO ESCRITÓRIO abaixo e na conversa. Nunca invente números, entregas, falhas ou projetos. Se o retrato não tem a informação, diga isso e sugira o que fazer.",
    "Quando a Marieli pedir um trabalho (analisar, corrigir, criar, revisar algo em um projeto), não diga que já fez: proponha transformar em demanda para a equipe e preencha o campo demanda.",
    "Formato: até ~150 palavras, use listas curtas com '- ' quando ajudar. Pode usar **negrito** para destacar.",
    'Responda SOMENTE com JSON: {"resposta": "texto", "demanda": null | {"workspaceId": "id exato da lista de projetos", "texto": "pedido claro para a equipe"}}',
  ].join("\n");
  const history = input.history.slice(-8).map<LLMMessage>((t) => ({
    role: t.role === "user" ? "user" : "assistant",
    content: t.text.slice(0, 2000),
  }));
  return [
    { role: "system", content: `${system}\n\nRETRATO DO ESCRITÓRIO (agora, ${input.briefing.generatedAt}):\n${compactBriefing(input.briefing)}` },
    ...history,
    { role: "user", content: input.message.slice(0, 2000) },
  ];
}

export function parseOperaAnswer(text: string): { resposta: string; demanda: { workspaceId: string; texto: string } | null } | null {
  const candidates: string[] = [];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) candidates.push(fenced[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as Record<string, unknown>;
      const resposta = typeof obj["resposta"] === "string" ? obj["resposta"].trim() : "";
      if (!resposta) continue;
      const d = obj["demanda"] as Record<string, unknown> | null | undefined;
      const demanda =
        d && typeof d["workspaceId"] === "string" && typeof d["texto"] === "string" && d["texto"].trim()
          ? { workspaceId: d["workspaceId"], texto: d["texto"].trim() }
          : null;
      return { resposta, demanda };
    } catch {
      // tenta o proximo
    }
  }
  return null;
}

function toSuggestedDemand(d: { workspaceId: string; texto: string } | null): SuggestedDemand | null {
  if (!d) return null;
  const w = WORKSPACES.find((x) => x.id === d.workspaceId);
  if (!w) return null;
  return { workspaceId: w.id, workspaceName: w.name, text: d.texto.slice(0, 1000) };
}

/** Resposta sem IA: so fatos do retrato, nada generico. */
export function factualAnswer(message: string, b: CeoBriefing): { answer: string; demand: SuggestedDemand | null } {
  const parts: string[] = ["Estou sem IA neste momento, então respondo só com os fatos do escritório agora:"];
  if (b.approvalsPending.length) {
    parts.push(`- **${b.approvalsPending.length} aprovação(ões) esperando você**: ${b.approvalsPending.slice(0, 3).map((a) => a.title).join("; ")}`);
  } else {
    parts.push("- Nenhuma aprovação esperando você.");
  }
  parts.push(
    b.running.length ? `- Rodando agora: ${b.running.slice(0, 3).map((m) => `${m.objective} (${m.workspaceName})`).join("; ")}` : "- Nada rodando agora.",
  );
  parts.push(`- Últimas 24h: ${b.counts24h.completed} concluídas, ${b.counts24h.failed} com falha.`);
  if (b.failures.length) parts.push(`- Última falha: ${b.failures[0]!.objective} (${b.failures[0]!.workspaceName}) — ${b.failures[0]!.error}`);
  const ws = detectWorkspace(message);
  let demand: SuggestedDemand | null = null;
  if (looksLikeWork(message)) {
    const target = ws ?? { id: "operaia-lab", name: "OperaIA.lab" };
    demand = { workspaceId: target.id, workspaceName: target.name, text: message.trim().slice(0, 1000) };
    parts.push(`\nIsso parece um trabalho para a equipe. Posso transformar em demanda para **${target.name}**.`);
  }
  return { answer: parts.join("\n"), demand };
}

export async function chatWithOpera(input: {
  readonly llm: LLMProvider;
  readonly message: string;
  readonly history: readonly ChatTurn[];
  readonly briefing: CeoBriefing;
  readonly timeoutMs?: number;
}): Promise<OperaReply> {
  const messages = buildOperaMessages(input);
  try {
    // Limite de espera: o proxy corta em 60 s; melhor responder com fatos.
    const completion = await Promise.race([
      input.llm.complete(messages, { temperature: 0.4, maxTokens: 1500 }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), input.timeoutMs ?? 40_000)),
    ]);
    if (completion.model !== "deterministic") {
      const parsed = parseOperaAnswer(completion.content);
      const answer = parsed?.resposta ?? completion.content.trim().slice(0, 3000);
      if (answer) {
        return {
          answer,
          usedAi: true,
          model: completion.model,
          suggestedDemand: toSuggestedDemand(parsed?.demanda ?? null),
          briefingAt: input.briefing.generatedAt,
        };
      }
    }
  } catch {
    // cai na resposta factual
  }
  const fact = factualAnswer(input.message, input.briefing);
  return {
    answer: fact.answer,
    usedAi: false,
    model: "fatos-do-escritorio",
    suggestedDemand: fact.demand,
    briefingAt: input.briefing.generatedAt,
  };
}
