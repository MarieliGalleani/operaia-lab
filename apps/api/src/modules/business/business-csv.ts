/**
 * Andar 05 · Negócio — leitura da planilha de vendas.
 *
 * Aceita o que sai de verdade de ERP/Excel no Brasil: separador `;`, `,` ou
 * tab; campos entre aspas; cabecalho em portugues ou ingles; datas
 * dd/mm/aaaa ou aaaa-mm-dd; valores como "R$ 1.234,56" ou "1234.56".
 *
 * Funcao pura (sem banco): toda linha recusada volta com o numero da linha
 * e o motivo, para a tela mostrar exatamente o que corrigir.
 */
import { createHash } from "node:crypto";

export const MAX_SALES_ROWS = 50_000;

export interface ParsedSale {
  /** aaaa-mm-dd */
  readonly date: string;
  readonly customer: string;
  readonly product: string;
  readonly revenue: number;
  /** null quando a planilha nao tem coluna de custo. */
  readonly cost: number | null;
  readonly lineNumber: number;
  /** Chave estavel para nao contar a mesma venda duas vezes entre envios. */
  readonly dedupKey: string;
}

export interface RejectedLine {
  readonly lineNumber: number;
  readonly reason: string;
}

export interface SalesParseResult {
  readonly sales: readonly ParsedSale[];
  readonly rejected: readonly RejectedLine[];
  readonly hasCost: boolean;
  /** Erro que impede ler o arquivo inteiro (cabecalho, vazio, grande demais). */
  readonly fatal: string | null;
}

type Field = "date" | "customer" | "product" | "revenue" | "cost";

const HEADER_ALIASES: Readonly<Record<Field, readonly string[]>> = {
  date: ["data", "date", "data da venda", "data venda", "dt", "dia", "emissao", "data de emissao"],
  customer: ["cliente", "customer", "comprador", "nome do cliente", "razao social", "client"],
  product: ["produto", "product", "item", "servico", "descricao", "produto/servico", "sku"],
  revenue: [
    "receita",
    "revenue",
    "valor",
    "valor total",
    "faturamento",
    "total",
    "venda",
    "valor da venda",
    "preco",
    "valor (r$)",
    "receita (r$)",
  ],
  cost: ["custo", "cost", "custo total", "cmv", "custo (r$)", "custo do produto"],
};

const REQUIRED: readonly Field[] = ["date", "customer", "product", "revenue"];

const FIELD_LABEL: Readonly<Record<Field, string>> = {
  date: "data",
  customer: "cliente",
  product: "produto",
  revenue: "valor",
  cost: "custo",
};

export function normalizeHeader(value: string): string {
  return value
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

function detectDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t"] as const;
  let best: string = ",";
  let bestCount = 0;
  for (const c of candidates) {
    const count = splitLine(headerLine, c).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

/** Divide uma linha respeitando aspas ("a;b" fica inteiro; "" vira "). */
export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((v) => v.trim());
}

/**
 * Converte "R$ 1.234,56", "1234,56", "1,234.56", "1234.56", "-50" em numero.
 * Sem separador decimal claro, ponto com grupos de 3 digitos e milhar (BR).
 */
export function parseMoney(raw: string): number | null {
  let v = raw.replace(/R\$|\s| /gi, "");
  if (!v) return null;
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (v.startsWith("-")) {
    negative = !negative;
    v = v.slice(1);
  }
  if (!/^[\d.,]+$/.test(v)) return null;
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  } else if (lastComma >= 0) {
    if ((v.match(/,/g) ?? []).length > 1) return null;
    normalized = v.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(v) ? v.replace(/\./g, "") : v;
    if ((normalized.match(/\./g) ?? []).length > 1) return null;
  } else {
    normalized = v;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** dd/mm/aaaa, dd-mm-aaaa, dd/mm/aa ou aaaa-mm-dd (com hora opcional) -> aaaa-mm-dd. */
export function parseDate(raw: string): string | null {
  const v = raw.trim().split(/[ T]/)[0] ?? "";
  let y: number;
  let m: number;
  let d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (match) {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
    if (!match) return null;
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if (y < 100) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function resolveColumns(headers: readonly string[]): Partial<Record<Field, number>> {
  const normalized = headers.map(normalizeHeader);
  const columns: Partial<Record<Field, number>> = {};
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    const idx = normalized.findIndex((h) => HEADER_ALIASES[field].includes(h));
    if (idx >= 0) columns[field] = idx;
  }
  return columns;
}

function fail(fatal: string): SalesParseResult {
  return { sales: [], rejected: [], hasCost: false, fatal };
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function parseSalesCsv(content: string): SalesParseResult {
  const text = content.replace(/^﻿/, "");
  const lines = text.split(/\r\n|\n|\r/);
  const headerIndex = lines.findIndex((l) => l.trim().length > 0);
  if (headerIndex < 0) return fail("A planilha está vazia.");

  const headerLine = lines[headerIndex]!;
  const delimiter = detectDelimiter(headerLine);
  const columns = resolveColumns(splitLine(headerLine, delimiter));
  const missing = REQUIRED.filter((f) => columns[f] === undefined);
  if (missing.length > 0) {
    return fail(
      `Não encontrei a(s) coluna(s): ${missing.map((f) => FIELD_LABEL[f]).join(", ")}. ` +
        "A primeira linha precisa ter os nomes: data, cliente, produto, valor e (opcional) custo.",
    );
  }

  const dataLines = lines.length - headerIndex - 1;
  if (dataLines > MAX_SALES_ROWS + 1000) {
    return fail(`Planilha grande demais: o limite é ${MAX_SALES_ROWS.toLocaleString("pt-BR")} vendas por envio.`);
  }

  const hasCost = columns.cost !== undefined;
  const sales: ParsedSale[] = [];
  const rejected: RejectedLine[] = [];
  const seen = new Map<string, number>();

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const raw = lines[i]!;
    if (!raw.trim()) continue;
    const lineNumber = i + 1;
    const cells = splitLine(raw, delimiter);
    if (cells.every((c) => c === "")) continue;
    const get = (f: Field): string => {
      const idx = columns[f];
      return idx === undefined ? "" : (cells[idx] ?? "");
    };

    const date = parseDate(get("date"));
    if (!date) {
      rejected.push({ lineNumber, reason: `Data inválida: "${get("date")}" (use dd/mm/aaaa)` });
      continue;
    }
    const customer = cleanText(get("customer"));
    const product = cleanText(get("product"));
    if (!customer || !product) {
      rejected.push({ lineNumber, reason: "Cliente e produto são obrigatórios" });
      continue;
    }
    const revenue = parseMoney(get("revenue"));
    if (revenue === null || revenue < 0) {
      rejected.push({ lineNumber, reason: `Valor inválido: "${get("revenue")}"` });
      continue;
    }
    let cost: number | null = null;
    if (hasCost) {
      const rawCost = get("cost");
      cost = rawCost.trim() === "" ? 0 : parseMoney(rawCost);
      if (cost === null || cost < 0) {
        rejected.push({ lineNumber, reason: `Custo inválido: "${rawCost}"` });
        continue;
      }
    }
    if (sales.length >= MAX_SALES_ROWS) {
      rejected.push({ lineNumber, reason: "Acima do limite de vendas por envio" });
      continue;
    }

    const base = [date, customer.toLowerCase(), product.toLowerCase(), revenue.toFixed(2), cost === null ? "" : cost.toFixed(2)].join("|");
    // Duas vendas identicas no mesmo dia sao legitimas: a ocorrencia entra na chave.
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    const dedupKey = createHash("sha256").update(`${base}|${occurrence}`).digest("hex");

    sales.push({
      date,
      customer,
      product,
      revenue: round2(revenue),
      cost: cost === null ? null : round2(cost),
      lineNumber,
      dedupKey,
    });
  }

  if (sales.length === 0 && rejected.length === 0) {
    return fail("A planilha só tem o cabeçalho. Coloque ao menos uma venda.");
  }
  return { sales, rejected, hasCost, fatal: null };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
