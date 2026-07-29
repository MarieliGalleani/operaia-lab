/**
 * Backfill idempotente M1 — deriva notes a partir do ledger.
 * Requer Prisma (operational_memory_notes). Nao cria chat.
 */
import { randomUUID } from "node:crypto";
import {
  MEMORY_KIND_ORG_LEARNING,
  MEMORY_KIND_RUN_SUMMARY,
  MEMORY_LAYER_OPERATIONAL,
  MEMORY_ORIGIN_BACKFILL_LEARNING,
  MEMORY_ORIGIN_BACKFILL_MISSION,
  MEMORY_SOURCE_LEARNING,
  MEMORY_SOURCE_MISSION,
  defaultExpiresAt,
  type MemoryStore,
} from "@operaia/memory";
import { prisma } from "@operaia/database";

export interface BackfillOperationalMemoryInput {
  readonly memory: MemoryStore;
  readonly workspaceId?: string;
  readonly maxAgeDays?: number;
}

export interface BackfillOperationalMemoryResult {
  readonly learningCreated: number;
  readonly learningSkipped: number;
  readonly missionCreated: number;
  readonly missionSkipped: number;
}

export async function backfillOperationalMemory(
  input: BackfillOperationalMemoryInput,
): Promise<BackfillOperationalMemoryResult> {
  const maxAgeDays = input.maxAgeDays ?? 90;
  const since = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
  const expiresAt = defaultExpiresAt(new Date(), maxAgeDays);

  let learningCreated = 0;
  let learningSkipped = 0;
  let missionCreated = 0;
  let missionSkipped = 0;

  const learnings = await prisma.missionLearning.findMany({
    where: {
      createdAt: { gte: since },
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  for (const row of learnings) {
    if (
      await noteExists({
        workspaceId: row.workspaceId,
        sourceType: MEMORY_SOURCE_LEARNING,
        sourceId: row.id,
        kind: MEMORY_KIND_ORG_LEARNING,
      })
    ) {
      learningSkipped += 1;
      continue;
    }

    await input.memory.store({
      id: randomUUID(),
      content: [
        `Workspace: ${row.workspaceId}`,
        `Objetivo: ${row.context}`,
        `Decisao: ${row.decision}`,
        `Resultado: ${row.result}`,
        `Licao: ${row.lessonsLearned}`,
        row.reuseWhen ? `Reutilizar quando: ${row.reuseWhen}` : "",
        row.avoidWhen ? `Evitar quando: ${row.avoidWhen}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: {
        workspaceId: row.workspaceId,
        layer: MEMORY_LAYER_OPERATIONAL,
        kind: MEMORY_KIND_ORG_LEARNING,
        sourceType: MEMORY_SOURCE_LEARNING,
        sourceId: row.id,
        origin: MEMORY_ORIGIN_BACKFILL_LEARNING,
        missionId: row.missionId,
        learningId: row.id,
        objective: row.context,
        decision: row.decision,
        resultSummary: row.result,
        risksJson: row.risksFound,
        nextActionsJson: {
          reuseWhen: row.reuseWhen ?? null,
          avoidWhen: row.avoidWhen ?? null,
        },
        expiresAt: expiresAt.toISOString(),
      },
    });
    learningCreated += 1;
  }

  const missions = await prisma.mission.findMany({
    where: {
      status: "COMPLETED",
      finishedAt: { gte: since },
      missionKind: "COORDINATE",
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  for (const mission of missions) {
    const resultJson = mission.resultJson as {
      usableResult?: string;
      final?: { output?: { report?: { summary?: string } } };
    } | null;
    const summary =
      resultJson?.usableResult ??
      resultJson?.final?.output?.report?.summary ??
      null;
    if (!summary) {
      missionSkipped += 1;
      continue;
    }

    if (
      await noteExists({
        workspaceId: mission.workspaceId,
        sourceType: MEMORY_SOURCE_MISSION,
        sourceId: mission.id,
        kind: MEMORY_KIND_RUN_SUMMARY,
      })
    ) {
      missionSkipped += 1;
      continue;
    }

    await input.memory.store({
      id: randomUUID(),
      content: [
        `Workspace: ${mission.workspaceId}`,
        `Objetivo: ${mission.objective}`,
        `Resumo: ${summary}`,
      ].join("\n"),
      metadata: {
        workspaceId: mission.workspaceId,
        layer: MEMORY_LAYER_OPERATIONAL,
        kind: MEMORY_KIND_RUN_SUMMARY,
        sourceType: MEMORY_SOURCE_MISSION,
        sourceId: mission.id,
        origin: MEMORY_ORIGIN_BACKFILL_MISSION,
        missionId: mission.id,
        statusFinal: mission.status,
        objective: mission.objective,
        resultSummary: summary,
        expiresAt: expiresAt.toISOString(),
      },
    });
    missionCreated += 1;
  }

  return {
    learningCreated,
    learningSkipped,
    missionCreated,
    missionSkipped,
  };
}

async function noteExists(input: {
  workspaceId: string;
  sourceType: string;
  sourceId: string;
  kind: string;
}): Promise<boolean> {
  const row = await prisma.operationalMemoryNote.findUnique({
    where: {
      workspaceId_sourceType_sourceId_kind: input,
    },
    select: { id: true },
  });
  return row !== null;
}
