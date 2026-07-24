import { randomUUID } from "node:crypto";
import type { MemoryStore } from "@operaia/memory";

export interface LoadMissionMemoryInput {
  readonly workspaceId: string;
  readonly objective: string;
  readonly topK?: number;
}

export interface PersistMissionMemoryInput {
  readonly workspaceId: string;
  readonly missionId: string;
  readonly objective: string;
  readonly summary: string;
}

/**
 * Porta de memoria da missao operacional.
 * Usa apenas o contrato MemoryStore — sem acoplar Employees a infra.
 */
export async function loadMissionMemoryNotes(
  memory: MemoryStore,
  input: LoadMissionMemoryInput,
): Promise<readonly string[]> {
  const results = await memory.search({
    text: input.objective,
    topK: input.topK ?? 5,
    filter: { workspaceId: input.workspaceId },
  });

  return results.map((item) => item.record.content);
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
      missionId: input.missionId,
      kind: "operational-run-summary",
    },
  });
}
