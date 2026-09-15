/**
 * Nicho/Cliente (P1.X Fases 1, 3 e Carteira) — identidade compartilhada por
 * QUALQUER andar com pipeline por cliente (Marketing/Mercurio,
 * Automacao/Atlas, e o que vier depois). Um mesmo Cliente pode ter uma
 * campanha de Marketing E um engajamento de Automacao ao mesmo tempo.
 */
import { prisma } from "@operaia/database";

/** Normaliza um texto (nicho ou cliente) para deduplicar grafias levemente diferentes. */
export function normalizeSlug(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Encontra ou cria o Nicho correspondente ao texto digitado, agrupando trabalhos do mesmo setor. */
export async function resolveNicheId(nicheText: string): Promise<string> {
  const slug = normalizeSlug(nicheText);
  const niche = await prisma.niche.upsert({
    where: { slug },
    update: {},
    create: { name: nicheText.trim(), slug },
  });
  return niche.id;
}

/** Encontra ou cria o Cliente (dentro do nicho) correspondente ao nome digitado. */
export async function resolveClientId(nicheId: string, clientName: string): Promise<string> {
  const slug = normalizeSlug(clientName);
  const client = await prisma.client.upsert({
    where: { nicheId_slug: { nicheId, slug } },
    update: {},
    create: { name: clientName.trim(), slug, nicheId },
  });
  return client.id;
}

export interface NicheSummary {
  readonly id: string;
  readonly name: string;
  readonly campaignCount: number;
}

export async function listNiches(): Promise<readonly NicheSummary[]> {
  const niches = await prisma.niche.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { campaigns: true } } },
  });
  return niches.map((niche) => ({
    id: niche.id,
    name: niche.name,
    campaignCount: niche._count.campaigns,
  }));
}

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

export async function listClients(): Promise<readonly ClientSummary[]> {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { niche: { select: { name: true } }, _count: { select: { campaigns: true } } },
  });
  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    nicheName: client.niche.name,
    campaignCount: client._count.campaigns,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    setupPaid: client.setupPaid,
    recurringActive: client.recurringActive,
    active: client.active,
    createdAt: client.createdAt.toISOString(),
  }));
}

export class ClientAlreadyExistsError extends Error {
  constructor(nicheName: string, clientName: string) {
    super(`Já existe um cliente chamado "${clientName}" no nicho "${nicheName}".`);
    this.name = "ClientAlreadyExistsError";
  }
}

export interface CreateClientInput {
  readonly nicheName: string;
  readonly name: string;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
}

/** Cadastro direto de cliente — sem precisar passar por uma campanha primeiro. */
export async function createClient(input: CreateClientInput): Promise<ClientSummary> {
  const nicheId = await resolveNicheId(input.nicheName);
  const slug = normalizeSlug(input.name);
  const existing = await prisma.client.findUnique({ where: { nicheId_slug: { nicheId, slug } } });
  if (existing) {
    throw new ClientAlreadyExistsError(input.nicheName.trim(), input.name.trim());
  }
  const client = await prisma.client.create({
    data: {
      name: input.name.trim(),
      slug,
      nicheId,
      contactName: input.contactName?.trim() || undefined,
      contactEmail: input.contactEmail?.trim() || undefined,
      contactPhone: input.contactPhone?.trim() || undefined,
    },
    include: { niche: { select: { name: true } }, _count: { select: { campaigns: true } } },
  });
  return {
    id: client.id,
    name: client.name,
    nicheName: client.niche.name,
    campaignCount: client._count.campaigns,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    setupPaid: client.setupPaid,
    recurringActive: client.recurringActive,
    active: client.active,
    createdAt: client.createdAt.toISOString(),
  };
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

export async function updateClient(id: string, input: UpdateClientInput): Promise<ClientSummary> {
  const client = await prisma.client.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      contactName: input.contactName === undefined ? undefined : (input.contactName?.trim() || null),
      contactEmail: input.contactEmail === undefined ? undefined : (input.contactEmail?.trim() || null),
      contactPhone: input.contactPhone === undefined ? undefined : (input.contactPhone?.trim() || null),
      setupPaid: input.setupPaid,
      recurringActive: input.recurringActive,
      active: input.active,
    },
    include: { niche: { select: { name: true } }, _count: { select: { campaigns: true } } },
  });
  return {
    id: client.id,
    name: client.name,
    nicheName: client.niche.name,
    campaignCount: client._count.campaigns,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    setupPaid: client.setupPaid,
    recurringActive: client.recurringActive,
    active: client.active,
    createdAt: client.createdAt.toISOString(),
  };
}

export interface StaleClient {
  readonly clientId: string;
  readonly clientName: string;
  readonly daysSinceActivity: number;
}

export interface ClientActivitySignal {
  readonly clientId: string;
  readonly clientName: string;
  readonly lastActivityAt: string;
}

/** Pura e testável: quem não tem sinal de trabalho recente (campanha, engajamento,
 * métrica ou pagamento) vira alerta no painel geral — ordenado do mais parado primeiro. */
export function computeStaleClients(
  signals: readonly ClientActivitySignal[],
  now: Date,
  staleDays = 14,
): readonly StaleClient[] {
  return signals
    .map((signal) => ({
      clientId: signal.clientId,
      clientName: signal.clientName,
      daysSinceActivity: Math.floor(
        (now.getTime() - new Date(signal.lastActivityAt).getTime()) / 86_400_000,
      ),
    }))
    .filter((entry) => entry.daysSinceActivity >= staleDays)
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
}

export interface ClientsOverview {
  readonly totalClients: number;
  readonly activeClients: number;
  readonly setupPendingCount: number;
  readonly recurringActiveCount: number;
  readonly estimatedMrrBrl: number;
  readonly staleClients: readonly StaleClient[];
}

/** Painel geral do andar — visão de todos os clientes de uma vez, em vez de
 * precisar abrir cliente por cliente pra saber quem tá parado ou pendente. */
export async function getClientsOverview(staleDays = 14): Promise<ClientsOverview> {
  const clients = await prisma.client.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      setupPaid: true,
      recurringActive: true,
      campaigns: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
      automationEngagements: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
      metricEntries: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const totalClients = await prisma.client.count();
  const recurringActiveClients = clients.filter((c) => c.recurringActive);

  const latestRecurringPayments = await prisma.clientPayment.findMany({
    where: { kind: "RECORRENTE", clientId: { in: recurringActiveClients.map((c) => c.id) } },
    orderBy: { paidAt: "desc" },
    select: { clientId: true, amountBrl: true },
  });
  const mrrByClient = new Map<string, number>();
  for (const payment of latestRecurringPayments) {
    if (!mrrByClient.has(payment.clientId)) {
      mrrByClient.set(payment.clientId, payment.amountBrl);
    }
  }
  const estimatedMrrBrl = Array.from(mrrByClient.values()).reduce((sum, value) => sum + value, 0);

  const signals: ClientActivitySignal[] = clients.map((client) => {
    const timestamps = [
      client.updatedAt,
      client.campaigns[0]?.updatedAt,
      client.automationEngagements[0]?.updatedAt,
      client.metricEntries[0]?.createdAt,
      client.payments[0]?.createdAt,
    ].filter((d): d is Date => d !== undefined);
    const lastActivityAt = timestamps.reduce(
      (latest, d) => (d > latest ? d : latest),
      client.createdAt,
    );
    return { clientId: client.id, clientName: client.name, lastActivityAt: lastActivityAt.toISOString() };
  });

  return {
    totalClients,
    activeClients: clients.length,
    setupPendingCount: clients.filter((c) => !c.setupPaid).length,
    recurringActiveCount: recurringActiveClients.length,
    estimatedMrrBrl,
    staleClients: computeStaleClients(signals, new Date(), staleDays),
  };
}
