/**
 * Andar 05 · Negócio — tipos e chamadas da API (/api/v1/business/*).
 * Espelha apps/api/src/modules/business/business-analysis.ts.
 */
import { createHttpClient } from "@/data/adapters/http-client";

export type InsightCategory = "RISK" | "PROBLEM" | "OPPORTUNITY";
export type InsightSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type HealthLevel = "EXCELLENT" | "GOOD" | "ATTENTION" | "CRITICAL";

export interface BusinessInsight {
  readonly key: string;
  readonly kind: string;
  readonly category: InsightCategory;
  readonly severity: InsightSeverity;
  readonly title: string;
  readonly detail: string;
  readonly action: string;
  readonly impactBrl: number | null;
  readonly impactLabel: string | null;
}

export interface BusinessKpis {
  readonly revenue: number;
  readonly cost: number | null;
  readonly profit: number | null;
  readonly marginPct: number | null;
  readonly salesCount: number;
  readonly customersCount: number;
  readonly productsCount: number;
  readonly avgTicket: number;
  readonly revenueTrendPct: number | null;
  readonly last30Revenue: number;
  readonly prev30Revenue: number;
}

export interface MonthPoint {
  readonly month: string;
  readonly label: string;
  readonly revenue: number;
  readonly profit: number | null;
  readonly sales: number;
}

export interface RankedCustomer {
  readonly name: string;
  readonly revenue: number;
  readonly sharePct: number;
  readonly sales: number;
  readonly lastPurchase: string;
  readonly daysSinceLastPurchase: number;
}

export interface RankedProduct {
  readonly name: string;
  readonly revenue: number;
  readonly sharePct: number;
  readonly sales: number;
  readonly marginPct: number | null;
}

export interface BusinessDashboard {
  readonly empty: boolean;
  readonly period: { readonly from: string; readonly to: string } | null;
  readonly hasCost: boolean;
  readonly kpis: BusinessKpis;
  readonly health: { readonly score: number; readonly level: HealthLevel; readonly label: string };
  readonly summary: string;
  readonly priority: BusinessInsight | null;
  readonly insights: readonly BusinessInsight[];
  readonly months: readonly MonthPoint[];
  readonly topCustomers: readonly RankedCustomer[];
  readonly topProducts: readonly RankedProduct[];
  readonly importsCount: number;
  readonly lastImportAt: string | null;
}

export interface BusinessImport {
  readonly id: string;
  readonly fileName: string;
  readonly rowsReceived: number;
  readonly rowsAccepted: number;
  readonly rowsDuplicated: number;
  readonly rowsRejected: number;
  readonly rejected: readonly { readonly lineNumber: number; readonly reason: string }[];
  readonly hasCost: boolean;
  readonly salesStored: number;
  readonly createdBy: string | null;
  readonly createdAt: string;
}

/** Mesmo limite da API (8 MB de texto). */
export const MAX_FILE_BYTES = 8_000_000;

const http = createHttpClient();

export function fetchDashboard(): Promise<BusinessDashboard> {
  return http.get<BusinessDashboard>("/business/dashboard");
}

export function fetchImports(): Promise<readonly BusinessImport[]> {
  return http.get<readonly BusinessImport[]>("/business/imports");
}

export function removeImport(id: string): Promise<{ ok: boolean }> {
  return http.delete<{ ok: boolean }>(`/business/imports/${encodeURIComponent(id)}`);
}

/**
 * Lê o arquivo escolhido e envia. Excel salva CSV em Windows-1252 quando
 * tem acento: se o UTF-8 vier com caractere quebrado, relê como latin1.
 */
export async function uploadSalesFile(file: File): Promise<BusinessImport> {
  if (!/\.(csv|txt)$/i.test(file.name)) {
    throw new Error("Envie a planilha salva como CSV (no Excel: Arquivo › Salvar como › CSV).");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Planilha grande demais (máximo 8 MB). Divida em partes, por exemplo por ano.");
  }
  const buffer = await file.arrayBuffer();
  let csv = new TextDecoder("utf-8").decode(buffer);
  if (csv.includes("�")) csv = new TextDecoder("windows-1252").decode(buffer);
  return http.post<BusinessImport>("/business/imports", { fileName: file.name, csv });
}

/** Planilha-modelo para baixar e preencher. */
export const TEMPLATE_CSV = [
  "data;cliente;produto;valor;custo",
  "05/01/2026;Mercado Bom Preço;Café 500g;1.250,00;800,00",
  "12/01/2026;Padaria Central;Café 500g;420,00;270,00",
  "20/01/2026;Mercado Bom Preço;Açúcar 5kg;980,00;690,00",
].join("\n");

export function downloadTemplate(): void {
  const blob = new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-vendas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function pct(value: number | null, digits = 1): string {
  return value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
}

export function dateBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export const CATEGORY_LABEL: Readonly<Record<InsightCategory, string>> = {
  RISK: "Risco",
  PROBLEM: "Problema",
  OPPORTUNITY: "Oportunidade",
};

export const SEVERITY_LABEL: Readonly<Record<InsightSeverity, string>> = {
  CRITICAL: "Urgente",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};
