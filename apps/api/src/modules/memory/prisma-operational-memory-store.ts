/**
 * MemoryStore M1 persistente (PostgreSQL / Prisma).
 * Indice derivado — Mission / MissionLearning continuam fonte de verdade.
 */
import {
  clampMemoryContent,
  defaultExpiresAt,
  isAllowedM1Kind,
  MEMORY_KIND_RUN_SUMMARY,
  MEMORY_LAYER_OPERATIONAL,
  MEMORY_M1_DEFAULT_TOP_K,
  MEMORY_M1_MAX_TOP_K,
  MEMORY_M1_QUOTA_PER_WORKSPACE,
  MemoryQuotaExceededError,
  MemoryWorkspaceRequiredError,
  type MemoryQuery,
  type MemoryRecord,
  type MemorySearchResult,
  type MemoryStore,
} from "@operaia/memory";
import { prisma, type Prisma } from "@operaia/database";

export interface PrismaOperationalMemoryStoreOptions {
  readonly quotaPerWorkspace?: number;
  readonly maxAgeDays?: number;
  /** Exige workspaceId no search (default true — produto). */
  readonly requireWorkspaceFilter?: boolean;
}

export class PrismaOperationalMemoryStore implements MemoryStore {
  private readonly quota: number;
  private readonly maxAgeDays: number;
  private readonly requireWorkspaceFilter: boolean;

  constructor(options: PrismaOperationalMemoryStoreOptions = {}) {
    this.quota = options.quotaPerWorkspace ?? MEMORY_M1_QUOTA_PER_WORKSPACE;
    this.maxAgeDays = options.maxAgeDays ?? 90;
    this.requireWorkspaceFilter = options.requireWorkspaceFilter ?? true;
  }

  async store(record: MemoryRecord): Promise<void> {
    const metadata = record.metadata ?? {};
    const workspaceId = asString(metadata.workspaceId);
    if (!workspaceId) {
      throw new Error("MemoryStore.store exige metadata.workspaceId (isolamento M1)");
    }

    const kind = asString(metadata.kind) ?? MEMORY_KIND_RUN_SUMMARY;
    if (!isAllowedM1Kind(kind)) {
      throw new Error(`kind M1 nao permitido: ${kind}`);
    }

    const sourceType = asString(metadata.sourceType);
    const sourceId = asString(metadata.sourceId);
    if (!sourceType || !sourceId) {
      throw new Error(
        "OperationalMemoryNote exige metadata.sourceType e metadata.sourceId",
      );
    }

    const origin = asString(metadata.origin) ?? "unknown";
    const content = clampMemoryContent(record.content);
    const expiresAt = parseDate(metadata.expiresAt) ?? defaultExpiresAt(
      new Date(),
      this.maxAgeDays,
    );

    const existing = await prisma.operationalMemoryNote.findUnique({
      where: {
        workspaceId_sourceType_sourceId_kind: {
          workspaceId,
          sourceType,
          sourceId,
          kind,
        },
      },
      select: { id: true, archivedAt: true },
    });

    if (!existing || existing.archivedAt) {
      const activeCount = await prisma.operationalMemoryNote.count({
        where: {
          workspaceId,
          archivedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (activeCount >= this.quota) {
        throw new MemoryQuotaExceededError(workspaceId, this.quota);
      }
    }

    const data = {
      content,
      layer: asString(metadata.layer) ?? MEMORY_LAYER_OPERATIONAL,
      origin,
      missionId: asString(metadata.missionId) ?? null,
      learningId: asString(metadata.learningId) ?? null,
      statusFinal: asString(metadata.statusFinal) ?? null,
      objective: asString(metadata.objective) ?? null,
      decision: asString(metadata.decision) ?? null,
      resultSummary: asString(metadata.resultSummary) ?? null,
      risksJson: toJson(metadata.risksJson ?? metadata.risksFound),
      nextActionsJson: toJson(metadata.nextActionsJson),
      metadataJson: metadata as Prisma.InputJsonValue,
      expiresAt,
      archivedAt: null,
    };

    await prisma.operationalMemoryNote.upsert({
      where: {
        workspaceId_sourceType_sourceId_kind: {
          workspaceId,
          sourceType,
          sourceId,
          kind,
        },
      },
      create: {
        id: record.id,
        workspaceId,
        kind,
        sourceType,
        sourceId,
        ...data,
      },
      update: data,
    });
  }

  async search(query: MemoryQuery): Promise<readonly MemorySearchResult[]> {
    const workspaceId = asString(query.filter?.workspaceId);
    if (this.requireWorkspaceFilter && !workspaceId) {
      throw new MemoryWorkspaceRequiredError();
    }

    const topK = Math.min(
      query.topK ?? MEMORY_M1_DEFAULT_TOP_K,
      MEMORY_M1_MAX_TOP_K,
    );
    const kind = asString(query.filter?.kind);
    const layer =
      asString(query.filter?.layer) ?? MEMORY_LAYER_OPERATIONAL;
    const maxAgeDays = asNumber(query.filter?.maxAgeDays) ?? this.maxAgeDays;
    const minCreatedAt = new Date(
      Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
    );
    const now = new Date();

    const rows = await prisma.operationalMemoryNote.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        layer,
        archivedAt: null,
        createdAt: { gte: minCreatedAt },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(kind ? { kind } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(topK * 10, 50),
    });

    const terms = tokenize(query.text);
    const scored: MemorySearchResult[] = [];

    for (const row of rows) {
      const record = rowToRecord(row);
      if (!matchesExtraFilters(record.metadata, query.filter)) {
        continue;
      }
      const score = scoreRecord(record.content, query.text, terms);
      if (score <= 0) {
        continue;
      }
      scored.push({ record, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

function rowToRecord(row: {
  id: string;
  content: string;
  workspaceId: string;
  layer: string;
  kind: string;
  sourceType: string;
  sourceId: string;
  origin: string;
  missionId: string | null;
  learningId: string | null;
  statusFinal: string | null;
  objective: string | null;
  decision: string | null;
  resultSummary: string | null;
  risksJson: Prisma.JsonValue | null;
  nextActionsJson: Prisma.JsonValue | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  expiresAt: Date | null;
}): MemoryRecord {
  const baseMeta =
    row.metadataJson && typeof row.metadataJson === "object"
      ? (row.metadataJson as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    content: row.content,
    metadata: {
      ...baseMeta,
      workspaceId: row.workspaceId,
      layer: row.layer,
      kind: row.kind,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      origin: row.origin,
      missionId: row.missionId ?? undefined,
      learningId: row.learningId ?? undefined,
      statusFinal: row.statusFinal ?? undefined,
      objective: row.objective ?? undefined,
      decision: row.decision ?? undefined,
      resultSummary: row.resultSummary ?? undefined,
      risksJson: row.risksJson ?? undefined,
      nextActionsJson: row.nextActionsJson ?? undefined,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString(),
    },
  };
}

function matchesExtraFilters(
  metadata: Readonly<Record<string, unknown>> | undefined,
  filter: Readonly<Record<string, unknown>> | undefined,
): boolean {
  if (!filter) {
    return true;
  }
  const meta = metadata ?? {};
  const reserved = new Set([
    "workspaceId",
    "layer",
    "kind",
    "maxAgeDays",
  ]);
  return Object.entries(filter).every(([key, value]) => {
    if (reserved.has(key)) {
      return true;
    }
    return meta[key] === value;
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  return undefined;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3);
}

function scoreRecord(
  content: string,
  rawQuery: string,
  terms: readonly string[],
): number {
  const haystack = content.toLowerCase();
  const needle = rawQuery.trim().toLowerCase();

  if (needle.length > 0 && haystack.includes(needle)) {
    return 1;
  }

  if (terms.length === 0) {
    // Sem termos: ainda retorna recentes com score baixo (continuidade).
    return 0.01;
  }

  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      hits += 1;
    }
  }
  return hits / terms.length;
}
