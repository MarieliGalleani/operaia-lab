/**
 * Nicho/Cliente (P1.X Fases 1 e 3) — identidade compartilhada por QUALQUER
 * andar com pipeline por cliente (Marketing/Mercurio, Automacao/Atlas, e o
 * que vier depois). Um mesmo Cliente pode ter uma campanha de Marketing E
 * um engajamento de Automacao ao mesmo tempo.
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
  readonly setupPaid: boolean;
  readonly recurringActive: boolean;
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
    setupPaid: client.setupPaid,
    recurringActive: client.recurringActive,
  }));
}
