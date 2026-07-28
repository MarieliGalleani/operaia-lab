/**
 * Memoria organizacional — registro estruturado apos cada missao.
 */
import { prisma, type Prisma } from "@operaia/database";
import type { MemoryStore } from "@operaia/memory";
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
}

export async function recordMissionLearning(
  memory: MemoryStore,
  input: RecordMissionLearningInput,
): Promise<void> {
  await prisma.missionLearning.upsert({
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
      missionId: input.missionId,
      kind: "organizational-learning",
    },
  });
}

export async function loadOrganizationalLearningNotes(
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
