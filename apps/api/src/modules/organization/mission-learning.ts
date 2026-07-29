/**
 * Memoria organizacional — registro estruturado apos cada missao.
 * Escrita: MissionLearning (verdade) + MemoryStore (indice M1).
 * Leitura M1.4: apenas MemoryStore; fallback Prisma opt-in na migracao.
 */
import { prisma, type Prisma } from "@operaia/database";
import {
  MEMORY_KIND_ORG_LEARNING,
  MEMORY_LAYER_OPERATIONAL,
  MEMORY_ORIGIN_RECORD_LEARNING,
  MEMORY_SOURCE_LEARNING,
  defaultExpiresAt,
  type MemoryStore,
} from "@operaia/memory";
import { randomUUID } from "node:crypto";

export interface RecordMissionLearningInput {
  readonly missionId: string;
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly objective: string;
  readonly decision: string;
  readonly justification: string;
  readonly result: string;
  readonly impact?: string;
  readonly risksFound?: readonly string[];
  readonly lessonsLearned: string;
  readonly reuseWhen?: string;
  readonly avoidWhen?: string;
  readonly durationMs?: number;
  readonly metrics?: Record<string, unknown>;
  readonly origin?: string;
}

export interface LoadOrganizationalLearningInput {
  readonly workspaceId: string;
  readonly objective?: string;
  readonly topK?: number;
  /**
   * Fallback controlado para migracao: le MissionLearning se o indice estiver vazio.
   * Default false — caminho unificado MemoryStore-only.
   */
  readonly allowPrismaFallback?: boolean;
}

export async function recordMissionLearning(
  memory: MemoryStore,
  input: RecordMissionLearningInput,
): Promise<void> {
  const learning = await prisma.missionLearning.upsert({
    where: { missionId: input.missionId },
    create: {
      missionId: input.missionId,
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      context: input.objective,
      decision: input.decision,
      justification: input.justification,
      result: input.result,
      impact: input.impact,
      risksFound: (input.risksFound ?? []) as Prisma.InputJsonValue,
      lessonsLearned: input.lessonsLearned,
      reuseWhen: input.reuseWhen,
      avoidWhen: input.avoidWhen,
      durationMs: input.durationMs,
      metricsJson: (input.metrics ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      decision: input.decision,
      justification: input.justification,
      result: input.result,
      impact: input.impact,
      risksFound: (input.risksFound ?? []) as Prisma.InputJsonValue,
      lessonsLearned: input.lessonsLearned,
      reuseWhen: input.reuseWhen,
      avoidWhen: input.avoidWhen,
      durationMs: input.durationMs,
      metricsJson: (input.metrics ?? {}) as Prisma.InputJsonValue,
    },
  });

  await memory.store({
    id: randomUUID(),
    content: [
      `Workspace: ${input.workspaceId}`,
      `Objetivo: ${input.objective}`,
      `Decisao: ${input.decision}`,
      `Resultado: ${input.result}`,
      `Licao: ${input.lessonsLearned}`,
      input.reuseWhen ? `Reutilizar quando: ${input.reuseWhen}` : "",
      input.avoidWhen ? `Evitar quando: ${input.avoidWhen}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      workspaceId: input.workspaceId,
      layer: MEMORY_LAYER_OPERATIONAL,
      kind: MEMORY_KIND_ORG_LEARNING,
      sourceType: MEMORY_SOURCE_LEARNING,
      sourceId: learning.id,
      origin: input.origin ?? MEMORY_ORIGIN_RECORD_LEARNING,
      missionId: input.missionId,
      learningId: learning.id,
      objective: input.objective,
      decision: input.decision,
      resultSummary: input.result,
      risksJson: input.risksFound ?? [],
      nextActionsJson: {
        reuseWhen: input.reuseWhen ?? null,
        avoidWhen: input.avoidWhen ?? null,
      },
      expiresAt: defaultExpiresAt().toISOString(),
    },
  });
}

/**
 * Leitura de learnings via MemoryStore (indice M1).
 * Nao usa dual-read com MissionLearning, salvo fallback explicito.
 */
export async function loadOrganizationalLearningNotes(
  memory: MemoryStore,
  input: LoadOrganizationalLearningInput,
): Promise<readonly string[]> {
  const topK = input.topK ?? 5;
  const objective = input.objective ?? "learning";

  const results = await memory.search({
    text: objective,
    topK,
    filter: {
      workspaceId: input.workspaceId,
      layer: MEMORY_LAYER_OPERATIONAL,
      kind: MEMORY_KIND_ORG_LEARNING,
    },
  });

  if (results.length > 0) {
    return results.map((item) => formatLearningNote(item.record.content));
  }

  if (input.allowPrismaFallback !== true) {
    return [];
  }

  return loadOrganizationalLearningNotesFromPrisma(input.workspaceId, topK);
}

/** Fallback de migracao — ledger MissionLearning. Nao usar em produto apos cutover. */
export async function loadOrganizationalLearningNotesFromPrisma(
  workspaceId: string,
  topK = 5,
): Promise<readonly string[]> {
  const rows = await prisma.missionLearning.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: topK,
  });
  return rows.map(
    (row) =>
      `[LEARNING]${row.lessonsLearned}` +
      (row.reuseWhen ? ` | reutilizar: ${row.reuseWhen}` : "") +
      (row.avoidWhen ? ` | evitar: ${row.avoidWhen}` : ""),
  );
}

function formatLearningNote(content: string): string {
  if (content.startsWith("[LEARNING]")) {
    return content;
  }
  const lessonLine = content
    .split("\n")
    .find((line) => line.startsWith("Licao:"));
  if (!lessonLine) {
    return `[LEARNING]${content}`;
  }
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
