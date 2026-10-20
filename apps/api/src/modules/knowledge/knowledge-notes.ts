import { prisma } from "@operaia/database";

/**
 * Base de conhecimento → memoria das missoes (Interface 3.0).
 *
 * O que a usuaria escreve na Base de conhecimento de um projeto passa a
 * chegar a quem executa a missao, junto com as notas de memoria. Fica no
 * projeto, nao na pessoa: troca de especialista nao perde nada.
 */

const MAX_ITEMS_SCANNED = 40;
const MAX_NOTES = 3;
const MAX_CHARS = 600;

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 4),
  );
}

export interface KnowledgeItemLike {
  readonly title: string;
  readonly content: string | null;
  readonly updatedAt: Date;
}

/** Ordena por palavras em comum com o pedido; empate → mais recente. */
export function rankKnowledgeNotes(objective: string, items: readonly KnowledgeItemLike[]): string[] {
  const want = tokens(objective);
  return items
    .map((item) => {
      const have = tokens(`${item.title} ${item.content ?? ""}`);
      let score = 0;
      for (const t of want) if (have.has(t)) score += 1;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score || b.item.updatedAt.getTime() - a.item.updatedAt.getTime())
    .slice(0, MAX_NOTES)
    .map(({ item }) => {
      const body = (item.content ?? "").trim().replace(/\s+/g, " ");
      const text = body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS)}…` : body;
      return `[CONHECIMENTO] ${item.title}${text ? ` — ${text}` : ""}`;
    });
}

export async function loadKnowledgeNotes(workspaceId: string, objective: string): Promise<string[]> {
  try {
    const items = await prisma.knowledgeItem.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: MAX_ITEMS_SCANNED,
      select: { title: true, content: true, updatedAt: true },
    });
    return rankKnowledgeNotes(objective, items);
  } catch {
    // Base de conhecimento indisponivel nao pode travar a missao.
    return [];
  }
}
