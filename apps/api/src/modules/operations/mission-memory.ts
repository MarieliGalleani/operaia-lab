import { randomUUID } from "node:crypto";
import {
  MEMORY_KIND_ORG_LEARNING,
  MEMORY_KIND_RUN_SUMMARY,
  MEMORY_LAYER_OPERATIONAL,
  MEMORY_ORIGIN_PERSIST_MISSION,
  MEMORY_SOURCE_MISSION,
  defaultExpiresAt,
  type MemorySearchResult,
  type MemoryStore,
} from "@operaia/memory";

export interface LoadMissionMemoryInput {
  readonly workspaceId: string;
  readonly objective: string;
  readonly topK?: number;
}

export interface LoadOperationalMemoryInput extends LoadMissionMemoryInput {
  /**
   * Fallback controlado: se o indice M1 nao tiver learnings,
   * le MissionLearning (ledger) — so para migração.
   * Default false (caminho unificado MemoryStore-only).
   */
  readonly allowLearningPrismaFallback?: boolean;
  /** Injecao do fallback (testes); default usa mission-learning legacy. */
  readonly learningPrismaFallback?: (
    workspaceId: string,
    topK: number,
  ) => Promise<readonly string[]>;
}

export interface PersistMissionMemoryInput {
  readonly workspaceId: string;
  readonly missionId: string;
  readonly objective: string;
  readonly summary: string;
  readonly statusFinal?: string;
  readonly decision?: string;
  /** Origem da memoria — default persistMissionMemory. */
  readonly origin?: string;
}

/**
 * Leitura unificada M1.4 — apenas MemoryStore → OperationalMemoryNote.
 * Busca summaries + learnings, deduplica por sourceType:sourceId.
 * Employees nunca chamam isto — so a orquestração.
 */
export async function loadOperationalMemoryNotes(
  memory: MemoryStore,
  input: LoadOperationalMemoryInput,
): Promise<readonly string[]> {
  const topK = input.topK ?? 5;

  const [summaries, learnings] = await Promise.all([
    memory.search({
      text: input.objective,
      topK,
      filter: {
        workspaceId: input.workspaceId,
        layer: MEMORY_LAYER_OPERATIONAL,
        kind: MEMORY_KIND_RUN_SUMMARY,
      },
    }),
    memory.search({
      text: input.objective,
      topK,
      filter: {
        workspaceId: input.workspaceId,
        layer: MEMORY_LAYER_OPERATIONAL,
        kind: MEMORY_KIND_ORG_LEARNING,
      },
    }),
  ]);

  const merged = dedupeSearchResults([...summaries, ...learnings]);
  const notes = merged.map(formatMemoryNoteForBriefing);

  if (
    learnings.length === 0 &&
    input.allowLearningPrismaFallback === true &&
    input.learningPrismaFallback
  ) {
    const legacy = await input.learningPrismaFallback(
      input.workspaceId,
      topK,
    );
    return dedupeStrings([...notes, ...legacy]);
  }

  return notes;
}

/**
 * Porta de leitura M1 (compat). Delega ao caminho unificado.
 */
export async function loadMissionMemoryNotes(
  memory: MemoryStore,
  input: LoadMissionMemoryInput,
): Promise<readonly string[]> {
  return loadOperationalMemoryNotes(memory, input);
}

export async function persistMissionMemory(
  memory: MemoryStore,
  input: PersistMissionMemoryInput,
): Promise<void> {
  await memory.store({
    id: randomUUID(),
    content: [
      `Workspace: ${input.workspaceId}`,
      `Objetivo: ${input.objective}`,
      `Resumo: ${input.summary}`,
    ].join("\n"),
    metadata: {
      workspaceId: input.workspaceId,
      layer: MEMORY_LAYER_OPERATIONAL,
      kind: MEMORY_KIND_RUN_SUMMARY,
      sourceType: MEMORY_SOURCE_MISSION,
      sourceId: input.missionId,
      origin: input.origin ?? MEMORY_ORIGIN_PERSIST_MISSION,
      missionId: input.missionId,
      statusFinal: input.statusFinal,
      objective: input.objective,
      decision: input.decision,
      resultSummary: input.summary,
      expiresAt: defaultExpiresAt().toISOString(),
    },
  });
}

function formatMemoryNoteForBriefing(item: MemorySearchResult): string {
  const kind = item.record.metadata?.kind;
  const content = item.record.content;
  if (kind === MEMORY_KIND_ORG_LEARNING && !content.startsWith("[LEARNING]")) {
    const lessonLine = content
      .split("\n")
      .find((line) => line.startsWith("Licao:"));
    if (lessonLine) {
      const lesson = lessonLine.replace(/^Licao:\s*/, "");
      const reuse = content
        .split("\n")
        .find((line) => line.startsWith("Reutilizar quando:"));
      const avoid = content
        .split("\n")
        .find((line) => line.startsWith("Evitar quando:"));
      return (
        `[LEARNING]${lesson}` +
        (reuse ? ` | reutilizar: ${reuse.replace(/^Reutilizar quando:\s*/, "")}` : "") +
        (avoid ? ` | evitar: ${avoid.replace(/^Evitar quando:\s*/, "")}` : "")
      );
    }
    return `[LEARNING]${content}`;
  }
  return content;
}

function dedupeSearchResults(
  results: readonly MemorySearchResult[],
): readonly MemorySearchResult[] {
  const seen = new Set<string>();
  const out: MemorySearchResult[] = [];
  for (const item of results) {
    const sourceType = String(item.record.metadata?.sourceType ?? "");
    const sourceId = String(item.record.metadata?.sourceId ?? item.record.id);
    const key = `${sourceType}:${sourceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  // Mantem score: summaries e learnings ja vem ordenados por search;
  // reordena pelo score combinado.
  return [...out].sort((a, b) => b.score - a.score);
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}
