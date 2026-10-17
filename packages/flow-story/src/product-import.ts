/**
 * Importa produtos de um CSV exportado do portal de afiliados (ou de uma
 * planilha montada a mao). Cabecalhos aceitos em portugues ou ingles.
 *
 * Colunas: id, titulo|title, url|link, preco|price, comissao|commission
 * (8 ou 8% ou 0.08), nota|rating, vendidos|sold, categoria|category,
 * nota_loja|store_rating (opcional).
 */

import { normalizeText } from "./flow-robot.js";
import type { ProductCandidate } from "./types.js";

const HEADER_ALIASES: Readonly<Record<string, keyof ProductCandidate>> = {
  id: "id",
  titulo: "title",
  title: "title",
  nome: "title",
  url: "url",
  link: "url",
  preco: "price",
  price: "price",
  comissao: "commissionRate",
  commission: "commissionRate",
  nota: "rating",
  rating: "rating",
  vendidos: "soldCount",
  vendas: "soldCount",
  sold: "soldCount",
  categoria: "category",
  category: "category",
  nota_loja: "storeRating",
  store_rating: "storeRating",
};

function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === separator && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function parseNumber(raw: string): number {
  const clean = raw.replace(/R\$|%|\s/g, "");
  // "1.234,56" -> 1234.56 ; "1234.56" -> 1234.56
  // "1.500" (milhar brasileiro, sem decimal) -> 1500
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(clean)
      ? clean.replace(/\./g, "")
      : clean;
  return Number(normalized);
}

function parseCommission(raw: string): number {
  const value = parseNumber(raw);
  return raw.includes("%") || value > 1 ? value / 100 : value;
}

export function parseProductsCsv(csv: string): ProductCandidate[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const separator = (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitCsvLine(lines[0]!, separator).map(
    (h) => HEADER_ALIASES[normalizeText(h).replace(/\s+/g, "_")],
  );

  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line, separator);
    const row: Record<string, string> = {};
    headers.forEach((field, i) => {
      if (field) row[field] = cells[i] ?? "";
    });
    return {
      id: row.id || `linha-${index + 2}`,
      title: row.title ?? "",
      url: row.url ?? "",
      price: parseNumber(row.price ?? ""),
      commissionRate: parseCommission(row.commissionRate ?? ""),
      rating: parseNumber(row.rating ?? ""),
      soldCount: parseNumber(row.soldCount ?? "0") || 0,
      category: row.category ?? "",
      ...(row.storeRating ? { storeRating: parseNumber(row.storeRating) } : {}),
    };
  });
}
