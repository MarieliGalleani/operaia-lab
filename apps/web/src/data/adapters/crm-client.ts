/** Nicho/Cliente (P1.X Fases 1, 3 e 6) — compartilhado por qualquer andar
 * com pipeline por cliente (Marketing, Automação, e o que vier depois). */
import { createHttpClient } from "./http-client";

/** Nicho/setor atendido — agrupa trabalhos do mesmo setor. */
export interface NicheSummary {
  readonly id: string;
  readonly name: string;
  readonly campaignCount: number;
}

/** Cliente/empresa atendida — pertence a um nicho, conta como "cliente N do setor". */
export interface ClientSummary {
  readonly id: string;
  readonly name: string;
  readonly nicheName: string;
  readonly campaignCount: number;
  readonly setupPaid: boolean;
  readonly recurringActive: boolean;
}

export type ClientMetricKind = "TRAFEGO" | "PERFORMANCE" | "AUTOMACAO";

export interface MetricEntry {
  readonly id: string;
  readonly kind: ClientMetricKind;
  readonly metric: string;
  readonly channel: string | null;
  readonly period: string;
  readonly value: number;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface CreateMetricEntryInput {
  readonly kind: ClientMetricKind;
  readonly metric: string;
  readonly channel?: string;
  readonly period: string;
  readonly value: number;
  readonly note?: string;
}

export interface CrmClient {
  listNiches(): Promise<readonly NicheSummary[]>;
  listClients(): Promise<readonly ClientSummary[]>;
  listMetricEntries(clientId: string, kind: ClientMetricKind): Promise<readonly MetricEntry[]>;
  createMetricEntry(clientId: string, input: CreateMetricEntryInput): Promise<MetricEntry>;
  deleteMetricEntry(id: string): Promise<void>;
}

export function createCrmClient(): CrmClient {
  const http = createHttpClient();
  return {
    async listNiches() {
      return http.get<readonly NicheSummary[]>("/office/niches");
    },
    async listClients() {
      return http.get<readonly ClientSummary[]>("/office/clients");
    },
    async listMetricEntries(clientId, kind) {
      return http.get<readonly MetricEntry[]>(`/office/clients/${clientId}/metrics?kind=${kind}`);
    },
    async createMetricEntry(clientId, input) {
      return http.post<MetricEntry>(`/office/clients/${clientId}/metrics`, input);
    },
    async deleteMetricEntry(id) {
      await http.delete<{ ok: boolean }>(`/office/metrics/${id}`);
    },
  };
}
