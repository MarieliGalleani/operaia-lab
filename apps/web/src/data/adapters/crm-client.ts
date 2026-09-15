/** Nicho/Cliente (P1.X Fases 1, 3, 6 e Carteira) — compartilhado por qualquer andar
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
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly setupPaid: boolean;
  readonly recurringActive: boolean;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface CreateClientInput {
  readonly nicheName: string;
  readonly name: string;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
}

export interface UpdateClientInput {
  readonly name?: string;
  readonly contactName?: string | null;
  readonly contactEmail?: string | null;
  readonly contactPhone?: string | null;
  readonly setupPaid?: boolean;
  readonly recurringActive?: boolean;
  readonly active?: boolean;
}

export interface StaleClient {
  readonly clientId: string;
  readonly clientName: string;
  readonly daysSinceActivity: number;
}

export interface ClientsOverview {
  readonly totalClients: number;
  readonly activeClients: number;
  readonly setupPendingCount: number;
  readonly recurringActiveCount: number;
  readonly estimatedMrrBrl: number;
  readonly staleClients: readonly StaleClient[];
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

export type ClientPaymentKind = "SETUP" | "RECORRENTE";

export interface ClientPaymentEntry {
  readonly id: string;
  readonly kind: ClientPaymentKind;
  readonly amountBrl: number;
  readonly paidAt: string;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface CreatePaymentInput {
  readonly kind: ClientPaymentKind;
  readonly amountBrl: number;
  readonly paidAt: string;
  readonly note?: string;
}

export interface CrmClient {
  listNiches(): Promise<readonly NicheSummary[]>;
  listClients(): Promise<readonly ClientSummary[]>;
  getClientsOverview(): Promise<ClientsOverview>;
  createClient(input: CreateClientInput): Promise<ClientSummary>;
  updateClient(id: string, input: UpdateClientInput): Promise<ClientSummary>;
  listMetricEntries(clientId: string, kind: ClientMetricKind): Promise<readonly MetricEntry[]>;
  createMetricEntry(clientId: string, input: CreateMetricEntryInput): Promise<MetricEntry>;
  deleteMetricEntry(id: string): Promise<void>;
  listPayments(clientId: string): Promise<readonly ClientPaymentEntry[]>;
  createPayment(clientId: string, input: CreatePaymentInput): Promise<ClientPaymentEntry>;
  deletePayment(id: string): Promise<void>;
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
    async getClientsOverview() {
      return http.get<ClientsOverview>("/office/clients/overview");
    },
    async createClient(input) {
      return http.post<ClientSummary>("/office/clients", input);
    },
    async updateClient(id, input) {
      return http.patch<ClientSummary>(`/office/clients/${id}`, input);
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
    async listPayments(clientId) {
      return http.get<readonly ClientPaymentEntry[]>(`/office/clients/${clientId}/payments`);
    },
    async createPayment(clientId, input) {
      return http.post<ClientPaymentEntry>(`/office/clients/${clientId}/payments`, input);
    },
    async deletePayment(id) {
      await http.delete<{ ok: boolean }>(`/office/payments/${id}`);
    },
  };
}
