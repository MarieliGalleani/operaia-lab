/**
 * Trabalho de verdade sobre um pedido da usuaria (Interface 3.0).
 *
 * Antes, todo especialista fazia so a inspecao padrao do dominio (listar
 * a raiz, ler um arquivo fixo) e escrevia 2-3 frases genericas — mesmo
 * quando o pedido era especifico ("leia o README e sugira 3 melhorias").
 *
 * Agora, quando a missao vem de uma demanda humana ([HUMAN_DEMAND]):
 *   1. abre os arquivos citados no pedido (read-only, no maximo 3);
 *   2. junta a memoria do projeto que o runtime ja anexou ao briefing
 *      (notas e licoes de missoes anteriores + Base de conhecimento);
 *   3. pede ao LLM a resposta ao pedido, em JSON (resumo/achados/
 *      recomendacoes), sem inventar o que nao esta na evidencia.
 *
 * A memoria e do projeto, nao da pessoa: quem assumir a cadeira amanha
 * recebe as mesmas notas. A entrega volta para a memoria pelo runtime.
 */
import type { LLMMessage, LLMProvider } from "@operaia/ai-core";
import type {
  EmployeeBriefing,
  EmployeeDeliveryEvidence,
  EmployeeToolExecution,
} from "@operaia/employee-framework";

export const HUMAN_DEMAND_TAG = "[HUMAN_DEMAND]";

const MAX_FILES = 3;
const MAX_FILE_CHARS = 12_000;
const MAX_MEMORY_NOTES = 8;
const MAX_NOTE_CHARS = 500;

type ToolOk<T> = { readonly ok: true; readonly data: T };
type ToolErr = { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };
type ToolResult<T> = ToolOk<T> | ToolErr;

/** Subconjunto do ToolContext usado aqui (somente leitura). */
export interface TaskWorkTools {
  canUse(toolId: string): boolean;
  readFile?(input: { path: string }): Promise<ToolResult<Readonly<Record<string, unknown>>>>;
}

export interface TaskWorkInput {
  readonly llm: LLMProvider;
  readonly systemPrompt: string;
  readonly domainLabel: string;
  readonly briefing: EmployeeBriefing;
  readonly tools: TaskWorkTools | null;
  /** Evidencia que o especialista ja coletou (resumo em texto). */
  readonly priorEvidence: readonly string[];
}

export interface TaskWorkResult {
  readonly summary: string;
  readonly findings: readonly string[];
  readonly recommendations: readonly string[];
  readonly toolExecutions: readonly EmployeeToolExecution[];
  readonly evidence: readonly EmployeeDeliveryEvidence[];
  readonly memoryUsed: number;
  readonly filesRead: readonly string[];
}

export function isHumanDemandObjective(objective: string): boolean {
  return objective.includes(HUMAN_DEMAND_TAG);
}

/** Pedido limpo, sem marcas internas do runtime. */
export function cleanRequest(objective: string): string {
  return objective
    .replace(/\[HUMAN_DEMAND\]/g, "")
    .replace(/\[MISSION_INTENT\][^\n]*/g, "")
    .replace(/\[[A-Z_]+(?::[^\]]*)?\]/g, "")
    .trim();
}

const FILE_PATTERN = /(?:^|[\s"'`(])((?:[\w.-]+\/)*[\w.-]+\.(?:md|mdx|txt|ts|tsx|js|mjs|cjs|vue|json|ya?ml|toml|prisma|sql|py|sh|css|html|env\.example))(?=$|[\s"'`),.;:!?])/gi;

/** Arquivos citados no pedido. "README" sem extensao vira README.md. */
export function extractRequestedFiles(request: string): string[] {
  const found = new Set<string>();
  for (const match of request.matchAll(FILE_PATTERN)) {
    const path = match[1]!.replace(/^\.\//, "");
    if (!path.includes("..")) found.add(path);
  }
  if (/\breadme\b/i.test(request) && ![...found].some((f) => /readme/i.test(f))) {
    found.add("README.md");
  }
  return [...found].slice(0, MAX_FILES);
}

/** Notas de memoria e conhecimento que o runtime anexou ao briefing. */
export function readMemoryNotes(briefing: EmployeeBriefing): string[] {
  const raw = briefing.additional["memoryContext"];
  const notes = Array.isArray(raw) ? raw.filter((n): n is string => typeof n === "string") : [];
  return notes
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .slice(0, MAX_MEMORY_NOTES)
    .map((n) => (n.length > MAX_NOTE_CHARS ? `${n.slice(0, MAX_NOTE_CHARS)}…` : n));
}

function fileContent(data: Readonly<Record<string, unknown>>): string {
  const content = typeof data["content"] === "string" ? data["content"] : "";
  const encoding = data["encoding"];
  if (encoding === "base64" && content) {
    try {
      return Buffer.from(content, "base64").toString("utf8");
    } catch {
      return "";
    }
  }
  return content;
}

interface ParsedAnswer {
  readonly resumo: string;
  readonly achados: string[];
  readonly recomendacoes: string[];
}

/** Aceita JSON puro, em bloco ```json``` ou embutido no texto. */
export function parseAnswer(text: string): ParsedAnswer | null {
  const candidates: string[] = [];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) candidates.push(fenced[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text);
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as Record<string, unknown>;
      const resumo = typeof obj["resumo"] === "string" ? obj["resumo"].trim() : "";
      const list = (v: unknown) =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
      if (resumo) return { resumo, achados: list(obj["achados"]), recomendacoes: list(obj["recomendacoes"]) };
    } catch {
      // tenta o proximo formato
    }
  }
  return null;
}

export async function performRequestedWork(input: TaskWorkInput): Promise<TaskWorkResult> {
  const request = cleanRequest(input.briefing.objective);
  const executions: EmployeeToolExecution[] = [];
  const evidence: EmployeeDeliveryEvidence[] = [];
  const fileBlocks: string[] = [];
  const filesRead: string[] = [];

  const tools = input.tools;
  const canRead = Boolean(tools?.readFile && tools.canUse("readFile"));
  for (const path of extractRequestedFiles(request)) {
    if (!canRead) break;
    const at = new Date().toISOString();
    const result = await tools!.readFile!({ path });
    if (result.ok) {
      let content = fileContent(result.data);
      const truncated = content.length > MAX_FILE_CHARS;
      if (truncated) content = content.slice(0, MAX_FILE_CHARS);
      filesRead.push(path);
      executions.push({ toolId: "readFile", success: true, outcome: `path=${path} chars=${content.length}${truncated ? " (cortado)" : ""}`, at });
      evidence.push({ source: "readFile", data: { path, chars: content.length, truncated } });
      fileBlocks.push(`### Arquivo ${path}${truncated ? " (primeiros 12 mil caracteres)" : ""}\n${content}`);
    } else {
      executions.push({ toolId: "readFile", success: false, outcome: `${path}: ${result.error.code} ${result.error.message}`, at });
      evidence.push({ source: "readFile", data: { path, error: result.error.code, message: result.error.message } });
    }
  }

  const memory = readMemoryNotes(input.briefing);
  if (memory.length > 0) {
    evidence.push({ source: "memoria-do-projeto", data: { notas: memory.length } });
  }

  const messages: LLMMessage[] = [
    { role: "system", content: input.systemPrompt },
    {
      role: "user",
      content: [
        `Pedido da usuária (responda exatamente a isto): ${request}`,
        `Projeto: ${input.briefing.project}`,
        `Seu domínio: ${input.domainLabel}`,
        memory.length > 0
          ? `Memória do projeto (missões anteriores e Base de conhecimento — use se for relevante):\n- ${memory.join("\n- ")}`
          : "Memória do projeto: (vazia)",
        input.priorEvidence.length > 0 ? `Evidência coletada:\n- ${input.priorEvidence.slice(0, 8).join("\n- ")}` : "",
        fileBlocks.length > 0 ? `Conteúdo dos arquivos pedidos:\n\n${fileBlocks.join("\n\n")}` : "Nenhum arquivo foi aberto.",
        "",
        "Faça o trabalho pedido com base na evidência acima. Seja concreto e específico ao conteúdo real;",
        "não invente arquivos, números ou fatos que não estejam na evidência. Se faltar informação, diga o que faltou.",
        'Responda SOMENTE com JSON: {"resumo": "2-4 frases com a resposta", "achados": ["..."], "recomendacoes": ["..."]}',
        "Escreva em português do Brasil.",
      ]
        .filter((line) => line !== "")
        .join("\n"),
    },
  ];

  const completion = await input.llm.complete(messages, { temperature: 0.3, maxTokens: 2048 });
  const parsed = parseAnswer(completion.content);
  const summary = parsed?.resumo ?? completion.content.trim().slice(0, 1200);

  return {
    summary,
    findings: parsed?.achados.slice(0, 8) ?? [],
    recommendations: parsed?.recomendacoes.slice(0, 8) ?? [],
    toolExecutions: executions,
    evidence,
    memoryUsed: memory.length,
    filesRead,
  };
}
